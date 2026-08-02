package com.taichu.gateway.service;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.event.EventPublisher;
import com.taichu.gateway.event.RuntimeEventType;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.model.RuntimeStatus;
import com.taichu.gateway.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;
import java.util.UUID;

/**
 * 运行时服务, 业务逻辑编排: 仓储 + K8s 操作 + SSE 状态广播.
 * 设计文档第三章: 接收前端指令后动态创建用户独立 Pod, 通过 Redis Pub/Sub 广播状态变更.
 *
 * 状态机 (参考 yunyan-agent AgentRuntimeService):
 *   PENDING → CREATING → RUNNING → READY (创建流程)
 *   READY   → TERMINATING → TERMINATED (TTL 到期 / 删除)
 *   任意阶段 → FAILED
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeService {

    private final RuntimeRepository runtimeRepository;
    private final K8sRuntimeOperator k8sRuntimeOperator;
    private final PlatformProperties gatewayProperties;
    private final EventPublisher eventPublisher;
    private final WebClient.Builder webClientBuilder;

    /**
     * 可复用状态: Redis 索引命中且 status 处于该集合时直接复用现有 runtime,
     * 不创建新 Pod, 不触发 K8s 调度. 设计文档第三章: Redis 双索引 + 复用.
     */
    private static final Set<String> REUSABLE_STATUSES = Set.of(
            RuntimeStatus.PENDING.name().toLowerCase(),
            RuntimeStatus.CREATING.name().toLowerCase(),
            RuntimeStatus.RUNNING.name().toLowerCase(),
            RuntimeStatus.READY.name().toLowerCase()
    );

    /**
     * 创建运行时.
     *
     * 流程: 先查 Redis 复用现有 (秒级 ready); 未命中或不可复用才创建新 runtime (后台异步 provisioning).
     * 后台流程 publish CREATED → SCHEDULED → READY/FAILED 事件, 客户端通过 SSE 订阅.
     */
    public Mono<RuntimeSnapshot> create(String userId) {
        return runtimeRepository.findByUserId(userId)
                .flatMap(opt -> opt
                        .filter(s -> REUSABLE_STATUSES.contains(s.getStatus()))
                        .map(this::reuseExisting)
                        .orElseGet(() -> Mono.defer(() -> createNew(userId))))
                .switchIfEmpty(Mono.defer(() -> createNew(userId)));
    }

    /**
     * 复用现有 runtime: 续约 TTL + publish INITIAL_STATE 让客户端秒级 ready.
     */
    private Mono<RuntimeSnapshot> reuseExisting(RuntimeSnapshot existing) {
        long ttl = gatewayProperties.getRuntime().getTtl();
        long threshold = gatewayProperties.getRuntime().effectiveRenewThresholdSeconds();
        long throttle = gatewayProperties.getRuntime().getRenewThrottleSeconds();
        Instant now = Instant.now();
        existing.setLeaseExpireAt(now.plusSeconds(ttl));
        existing.setUpdatedAt(now);
        log.info("复用 runtime: userId={} runtimeId={} status={}",
                existing.getUserId(), existing.getRuntimeId(), existing.getStatus());
        return runtimeRepository.renewIfLow(existing, threshold, ttl, throttle)
                .then(eventPublisher.publish(RuntimeEventType.INITIAL_STATE, existing,
                        "复用现有 runtime (status=" + existing.getStatus() + ")"))
                .thenReturn(existing);
    }

    /**
     * 新建 runtime: 落 Redis 索引 + publish CREATED, 后台异步驱动 K8s 创建 + 探活 ready.
     */
    private Mono<RuntimeSnapshot> createNew(String userId) {
        String runtimeId = generateRuntimeId(userId);
        String deploymentName = "gateway-" + runtimeId;
        String serviceName = "gateway-" + runtimeId;
        String internalUrl = buildInternalUrl(serviceName);
        String agentApiBase = buildAgentApiBase(runtimeId);

        RuntimeSnapshot snapshot = new RuntimeSnapshot();
        snapshot.setRuntimeId(runtimeId);
        snapshot.setUserId(userId);
        snapshot.setStatus(RuntimeStatus.PENDING.name().toLowerCase());
        snapshot.setNamespace(gatewayProperties.getKubernetes().getNamespace());
        snapshot.setDeploymentName(deploymentName);
        snapshot.setServiceName(serviceName);
        snapshot.setInternalUrl(internalUrl);
        snapshot.setAgentApiBase(agentApiBase);
        snapshot.setLeaseExpireAt(Instant.now().plusSeconds(gatewayProperties.getRuntime().getTtl()));
        snapshot.setCreatedAt(Instant.now());
        snapshot.setUpdatedAt(Instant.now());

        log.info("创建 runtime: userId={} runtimeId={}", userId, runtimeId);

        return eventPublisher.publish(RuntimeEventType.CREATED, snapshot, RuntimeEventType.CREATED.getDefaultDescription())
                .then(runtimeRepository.save(snapshot, gatewayProperties.getRuntime().getTtl()))
                .doOnNext(saved -> runBackgroundProvisioning(saved).subscribe());
    }

    /**
     * 后台异步调度: 创建 K8s 资源 → 探活 sandbox → 状态变更 publish SSE 事件.
     * 错误处理: 任意环节失败, 状态置 FAILED + publish 事件, 不影响 POST 调用方已拿到的 PENDING 快照.
     */
    private Mono<Void> runBackgroundProvisioning(RuntimeSnapshot snapshot) {
        String runtimeId = snapshot.getRuntimeId();
        return k8sRuntimeOperator.create(snapshot)
                .flatMap(this::markScheduled)
                .flatMap(s -> eventPublisher.publish(RuntimeEventType.SCHEDULED, s, "K8s 资源已下发, 等待 sandbox 启动")
                        .thenReturn(s))
                .flatMap(k8sRuntimeOperator::waitForPodReady)
                .flatMap(this::awaitSandboxReady)
                .flatMap(this::markReady)
                .flatMap(ready -> runtimeRepository.save(ready, gatewayProperties.getRuntime().getTtl()))
                .flatMap(ready -> eventPublisher.publish(RuntimeEventType.READY, ready, "sandbox 已就绪")
                        .thenReturn(ready))
                .onErrorResume(err -> {
                    log.error("runtime 后台调度失败: runtimeId={}", runtimeId, err);
                    return markFailed(snapshot, err)
                            .flatMap(failed -> runtimeRepository.save(failed, gatewayProperties.getRuntime().getTtl())
                                    .thenReturn(failed))
                            .flatMap(failed -> eventPublisher.publish(RuntimeEventType.FAILED, failed, err.getMessage())
                                    .thenReturn(failed));
                })
                .then();
    }

    private Mono<RuntimeSnapshot> markScheduled(RuntimeSnapshot snapshot) {
        snapshot.setStatus(RuntimeStatus.RUNNING.name().toLowerCase());
        snapshot.setUpdatedAt(Instant.now());
        log.info("K8s 资源已下发: runtimeId={} status=running", snapshot.getRuntimeId());
        return Mono.just(snapshot);
    }

    /**
     * 探活 sandbox: 轮询 ${internalUrl}/global/health 直到 200, 超时则抛错.
     * 使用 Mono.expand 递归探测, 避免 Flux.interval 在 slow downstream 下的 demand 取消问题.
     */
    private Mono<RuntimeSnapshot> awaitSandboxReady(RuntimeSnapshot snapshot) {
        long intervalMs = Math.max(500L, gatewayProperties.getRuntime().getPollIntervalMs());
        long timeoutSec = gatewayProperties.getRuntime().getWaitTimeoutSeconds();
        String url = snapshot.getInternalUrl() + "/global/health";
        long deadline = System.currentTimeMillis() + timeoutSec * 1000L;
        log.info("探活 sandbox: url={} interval={}ms timeout={}s", url, intervalMs, timeoutSec);

        WebClient client = webClientBuilder.build();

        return probeOnce(client, url)
                .expand(status -> {
                    if (status.is2xxSuccessful()) {
                        return Mono.empty();
                    }
                    if (System.currentTimeMillis() > deadline) {
                        return Mono.error(new RuntimeException(
                                "sandbox 健康检查超时 " + timeoutSec + "s: " + url));
                    }
                    return Mono.delay(Duration.ofMillis(intervalMs))
                            .then(probeOnce(client, url));
                })
                .filter(HttpStatusCode::is2xxSuccessful)
                .next()
                .thenReturn(snapshot)
                .doOnSuccess(s -> log.info("sandbox 就绪: runtimeId={}", s.getRuntimeId()));
    }

    private Mono<HttpStatusCode> probeOnce(WebClient client, String url) {
        return client.get().uri(url)
                .exchangeToMono(r -> r.releaseBody().thenReturn(r.statusCode()))
                .timeout(Duration.ofSeconds(2))
                .onErrorResume(err -> {
                    log.debug("sandbox 健康检查未通过: {}", err.getMessage());
                    return Mono.just(HttpStatusCode.valueOf(503));
                });
    }

    private Mono<RuntimeSnapshot> markReady(RuntimeSnapshot snapshot) {
        snapshot.setStatus(RuntimeStatus.READY.name().toLowerCase());
        snapshot.setUpdatedAt(Instant.now());
        return Mono.just(snapshot);
    }

    private Mono<RuntimeSnapshot> markFailed(RuntimeSnapshot snapshot, Throwable err) {
        snapshot.setStatus(RuntimeStatus.FAILED.name().toLowerCase());
        snapshot.setUpdatedAt(Instant.now());
        return Mono.just(snapshot);
    }

    /**
     * 查询运行时状态.
     */
    public Mono<RuntimeSnapshot> findByUserId(String userId) {
        return runtimeRepository.findByUserId(userId)
                .flatMap(opt -> opt.map(Mono::just).orElseGet(() -> Mono.error(new RuntimeNotFoundException(userId))));
    }

    /**
     * 删除运行时.
     */
    public Mono<Boolean> delete(String userId) {
        return findByUserId(userId)
                .flatMap(snapshot -> eventPublisher.publish(RuntimeEventType.RECYCLED, snapshot, "用户主动删除")
                        .then(k8sRuntimeOperator.delete(snapshot))
                        .flatMap(deleted -> runtimeRepository.delete(snapshot.getRuntimeId())));
    }

    /**
     * 重启运行时. 立即返回 snapshot, 后台异步调度由 SSE 推 READY.
     */
    public Mono<RuntimeSnapshot> restart(String userId) {
        return findByUserId(userId)
                .flatMap(snapshot -> {
                    RuntimeSnapshot restarting = new RuntimeSnapshot();
                    restarting.setRuntimeId(snapshot.getRuntimeId());
                    restarting.setUserId(snapshot.getUserId());
                    restarting.setStatus(RuntimeStatus.RUNNING.name().toLowerCase());
                    restarting.setNamespace(snapshot.getNamespace());
                    restarting.setDeploymentName(snapshot.getDeploymentName());
                    restarting.setServiceName(snapshot.getServiceName());
                    restarting.setInternalUrl(snapshot.getInternalUrl());
                    restarting.setAgentApiBase(snapshot.getAgentApiBase());
                    restarting.setLeaseExpireAt(Instant.now().plusSeconds(gatewayProperties.getRuntime().getTtl()));
                    restarting.setCreatedAt(snapshot.getCreatedAt());
                    restarting.setUpdatedAt(Instant.now());
                    return eventPublisher.publish(RuntimeEventType.RESTARTED, restarting, "重启触发")
                            .then(runtimeRepository.save(restarting, gatewayProperties.getRuntime().getTtl()))
                            .doOnNext(saved -> runBackgroundProvisioning(saved).subscribe());
                });
    }

    private String generateRuntimeId(String userId) {
        return "rt-" + userId + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String buildInternalUrl(String serviceName) {
        String ns = gatewayProperties.getKubernetes().getNamespace();
        String dnsSuffix = gatewayProperties.getKubernetes().getDnsSuffix();
        return gatewayProperties.getRuntime().getScheme() + "://" + serviceName + "." + ns + "." + dnsSuffix;
    }

    private String buildAgentApiBase(String runtimeId) {
        PlatformProperties.Runtime r = gatewayProperties.getRuntime();
        return r.getScheme() + "://" + runtimeId + "." + r.getRuntimeHostSuffix() + r.getAgentPrefix();
    }

    /**
     * 运行时未找到异常.
     */
    public static class RuntimeNotFoundException extends RuntimeException {
        public RuntimeNotFoundException(String userId) {
            super("运行时未找到: userId=" + userId);
        }
    }
}