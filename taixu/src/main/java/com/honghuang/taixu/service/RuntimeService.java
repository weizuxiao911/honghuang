package com.honghuang.taixu.service;

import com.honghuang.taixu.config.TaixuProperties;
import com.honghuang.taixu.model.RuntimeSnapshot;
import com.honghuang.taixu.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.UUID;

/**
 * 运行时服务, 业务逻辑编排: 仓储 + K8s 操作.
 * 设计文档第三章: 接收前端指令后动态创建用户独立 Pod.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeService {

    private final RuntimeRepository runtimeRepository;
    private final K8sRuntimeOperator k8sRuntimeOperator;
    private final TaixuProperties taixuProperties;

    /**
     * 创建运行时.
     *
     * @param userId 用户 ID
     * @return 运行时快照
     */
    public Mono<RuntimeSnapshot> create(String userId) {
        String runtimeId = generateRuntimeId(userId);
        String deploymentName = "taixu-" + runtimeId;
        String serviceName = "taixu-" + runtimeId;
        String internalUrl = buildInternalUrl(serviceName);
        String agentApiBase = buildAgentApiBase();

        RuntimeSnapshot snapshot = new RuntimeSnapshot();
        snapshot.setRuntimeId(runtimeId);
        snapshot.setUserId(userId);
        snapshot.setStatus("pending");
        snapshot.setNamespace(taixuProperties.getKubernetes().getNamespace());
        snapshot.setDeploymentName(deploymentName);
        snapshot.setServiceName(serviceName);
        snapshot.setInternalUrl(internalUrl);
        snapshot.setAgentApiBase(agentApiBase);
        snapshot.setLeaseExpireAt(Instant.now().plusSeconds(taixuProperties.getRuntime().getTtl()));
        snapshot.setCreatedAt(Instant.now());
        snapshot.setUpdatedAt(Instant.now());

        log.info("创建运行时: userId={} runtimeId={}", userId, runtimeId);

        return k8sRuntimeOperator.create(snapshot)
                .flatMap(created -> {
                    created.setStatus("running");
                    created.setUpdatedAt(Instant.now());
                    return runtimeRepository.save(created, taixuProperties.getRuntime().getTtl());
                });
    }

    /**
     * 查询运行时状态.
     *
     * @param userId 用户 ID
     * @return 运行时快照
     */
    public Mono<RuntimeSnapshot> findByUserId(String userId) {
        return runtimeRepository.findByUserId(userId)
                .flatMap(opt -> opt.map(Mono::just).orElseGet(() -> Mono.error(new RuntimeNotFoundException(userId))));
    }

    /**
     * 删除运行时.
     *
     * @param userId 用户 ID
     * @return 是否删除成功
     */
    public Mono<Boolean> delete(String userId) {
        return findByUserId(userId)
                .flatMap(snapshot -> k8sRuntimeOperator.delete(snapshot)
                        .flatMap(deleted -> runtimeRepository.delete(snapshot.getRuntimeId())));
    }

    /**
     * 重启运行时.
     *
     * @param userId 用户 ID
     * @return 新快照
     */
    public Mono<RuntimeSnapshot> restart(String userId) {
        return findByUserId(userId)
                .flatMap(snapshot -> k8sRuntimeOperator.restart(snapshot)
                        .flatMap(restarted -> runtimeRepository.save(restarted, taixuProperties.getRuntime().getTtl())));
    }

    private String generateRuntimeId(String userId) {
        return "rt-" + userId + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    private String buildInternalUrl(String serviceName) {
        String ns = taixuProperties.getKubernetes().getNamespace();
        String dnsSuffix = taixuProperties.getKubernetes().getDnsSuffix();
        return taixuProperties.getRuntime().getScheme() + "://" + serviceName + "." + ns + "." + dnsSuffix;
    }

    private String buildAgentApiBase() {
        return taixuProperties.getRuntime().getScheme() + "://" + taixuProperties.getRuntime().getGatewayHost() + taixuProperties.getRuntime().getAgentPrefix();
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