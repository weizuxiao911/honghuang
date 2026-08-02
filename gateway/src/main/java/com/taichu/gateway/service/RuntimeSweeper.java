package com.taichu.gateway.service;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.model.RuntimeSnapshot;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.informers.ResourceEventHandler;
import io.fabric8.kubernetes.client.informers.SharedIndexInformer;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;

import java.time.Instant;
import java.util.List;

/**
 * 孤儿运行时兜底巡检 (主链路 keyspace 通知失效时的保险).
 *
 * 设计文档第四章流程 6: TTL 过期自动触发 Pod 销毁 + PVC 巡检.
 * keyspace 过期通知可能因 Redis 配置缺失 / 订阅断线 / 消息丢失而漏回收,
 * 本巡检定期对账 Deployment 与 Redis 运行时索引:
 *   - Deployment 创建时间超过宽限期 (默认 = ttl), 且
 *   - Redis 中无对应 {prefix}:runtime:{runtimeId} 索引
 * 视为孤儿, 走 RuntimeRecycler 回收.
 *
 * 开销控制 (对 K8s API server 零轮询影响):
 *   - Deployment 列表走 Fabric8 Informer 本地缓存: 启动时 list 一次 + watch 增量,
 *     断线自动重连, 巡检只读本地 store, 不周期性调用 K8s API.
 *   - Redis 对账一次 multiGet 批量完成, 不逐个 GET.
 *   - 宽限期过滤在前, 仅在候选上做 Redis 对账.
 *
 * 安全设计: Redis 查询异常时跳过本轮, 不因 Redis 故障误删活沙箱;
 * 宽限期防创建中竞态误判 (RuntimeService 先落 Redis 索引再创建 Deployment).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RuntimeSweeper implements DisposableBean {

    private final KubernetesClient kubernetesClient;
    private final ReactiveRedisTemplate<String, RuntimeSnapshot> runtimeRedisTemplate;
    private final RuntimeRecycler runtimeRecycler;
    private final PlatformProperties gatewayProperties;

    private volatile SharedIndexInformer<Deployment> informer;

    @PostConstruct
    public void start() {
        String namespace = gatewayProperties.getKubernetes().getNamespace();
        // informer: 启动时同步一次 list + watch 增量, 断线自动重连, resync=0 不周期回扫.
        // 巡检只读本地 store, 对 K8s API server 无周期性轮询.
        informer = kubernetesClient.apps().deployments().inNamespace(namespace)
                .withLabel("app", "gateway")
                .inform(new ResourceEventHandler<>() {
                    @Override
                    public void onAdd(Deployment d) {
                        log.debug("informer add: {}", d.getMetadata().getName());
                    }

                    @Override
                    public void onUpdate(Deployment oldDeployment, Deployment deployment) {
                        log.debug("informer update: {}", deployment.getMetadata().getName());
                    }

                    @Override
                    public void onDelete(Deployment d, boolean deletedFinalStateUnknown) {
                        log.debug("informer delete: {}", d.getMetadata().getName());
                    }
                }, 0);
        log.info("已启动 Deployment informer 缓存: namespace={} label=app=gateway (巡检零 K8s API 轮询)", namespace);
    }

    @Scheduled(
            fixedDelayString = "${gateway.runtime.reclaim.sweep-interval-seconds:300}000",
            initialDelayString = "${gateway.runtime.reclaim.sweep-initial-delay-seconds:30}000")
    public void sweep() {
        PlatformProperties.Reclaim reclaim = gatewayProperties.getRuntime().getReclaim();
        if (!reclaim.isSweepEnabled()) {
            return;
        }
        String prefix = gatewayProperties.getRedis().getKeyPrefix();
        String runtimeKeyPrefix = prefix + ":runtime:";
        Instant cutoff = Instant.now().minusSeconds(reclaim.getSweepGraceSeconds());

        List<Deployment> candidates = informer.getStore().list().stream()
                .filter(d -> {
                    String runtimeId = runtimeIdOf(d);
                    if (runtimeId == null || runtimeId.isBlank()) {
                        return false;
                    }
                    return Instant.parse(d.getMetadata().getCreationTimestamp()).isBefore(cutoff);
                })
                .toList();

        if (candidates.isEmpty()) {
            return;
        }
        log.info("兜底巡检: 发现 {} 个超宽限期 Deployment, 对账 Redis 索引", candidates.size());

        // 批量对账: 一次 multiGet 返回全部候选的索引状态, 避免逐个 GET 往返.
        List<String> keys = candidates.stream()
                .map(d -> runtimeKeyPrefix + runtimeIdOf(d))
                .toList();
        runtimeRedisTemplate.opsForValue().multiGet(keys)
                .flatMapMany(values -> {
                    if (values == null || values.size() != candidates.size()) {
                        log.warn("兜底巡检: Redis 批量对账结果异常, 本轮跳过 (values.size={})",
                                values == null ? 0 : values.size());
                        return Flux.empty();
                    }
                    Flux<Integer> orphans = Flux.empty();
                    for (int i = 0; i < candidates.size(); i++) {
                        if (values.get(i) == null) {
                            Deployment d = candidates.get(i);
                            String runtimeId = runtimeIdOf(d);
                            log.warn("兜底巡检回收孤儿 runtime: runtimeId={} deployment={}",
                                    runtimeId, d.getMetadata().getName());
                            orphans = orphans.concatWith(runtimeRecycler.recycle(runtimeId).thenReturn(1));
                        }
                    }
                    return orphans;
                })
                .onErrorResume(err -> {
                    log.error("兜底巡检对账失败(本轮跳过, 下轮重试): {}", err.getMessage(), err);
                    return Flux.empty();
                })
                .subscribe(
                        recycled -> { },
                        err -> log.error("兜底巡检失败: {}", err.getMessage(), err),
                        () -> log.info("兜底巡检完成"));
    }

    private String runtimeIdOf(Deployment deployment) {
        if (deployment.getMetadata() == null || deployment.getMetadata().getLabels() == null) {
            return null;
        }
        return deployment.getMetadata().getLabels().get("runtimeId");
    }

    @Override
    public void destroy() {
        if (informer != null) {
            informer.close();
        }
    }
}
