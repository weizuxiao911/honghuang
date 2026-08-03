package com.taichu.gateway.service;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.event.EventPublisher;
import com.taichu.gateway.event.RuntimeEventType;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.model.RuntimeStatus;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.Objects;

/**
 * 运行时回收执行器: TTL 到期后删除 K8s Deployment/Service + 广播 RECYCLED 事件.
 *
 * 设计文档第四章流程 6 (TTL 自动回收, PVC 数据留存):
 *   R-->>GW: key 过期 → GW->>K: 销毁 Pod + 巡检 PVC.
 * 两条触发链路共用本执行器:
 *   主链路: RedisExpiryListener 订阅 keyspace 过期通知 (notify-keyspace-events Ex).
 *   兜底:   RuntimeSweeper 定时巡检孤儿 Deployment.
 *
 * 幂等: K8s 删除 404 视为成功; gateway 多副本同时收到过期事件时重复回收无副作用.
 * PVC 数据留存: 只删 Deployment/Service, 不删共享 workspace PVC (subPath 按用户隔离).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class RuntimeRecycler {

    private final KubernetesClient kubernetesClient;
    private final K8sRuntimeOperator k8sRuntimeOperator;
    private final EventPublisher eventPublisher;
    private final PlatformProperties gatewayProperties;

    /**
     * 按 runtimeId 回收运行时.
     * 过期事件只携带 key 名 (快照已随 TTL 删除), 故按命名规则重建最小快照:
     * deploymentName = "runtime-" + runtimeId, serviceName 同 (与 RuntimeService.createNew 一致).
     * userId 从 K8s Deployment env (X_USER_ID) 反查, 仅用于 RECYCLED 事件广播; 查不到时跳过事件.
     */
    public Mono<Void> recycle(String runtimeId) {
        String namespace = gatewayProperties.getKubernetes().getNamespace();
        String deploymentName = "runtime-" + runtimeId;

        RuntimeSnapshot snapshot = new RuntimeSnapshot();
        snapshot.setRuntimeId(runtimeId);
        snapshot.setUserId(readUserId(namespace, deploymentName));
        snapshot.setStatus(RuntimeStatus.TERMINATING.name().toLowerCase());
        snapshot.setNamespace(namespace);
        snapshot.setDeploymentName(deploymentName);
        snapshot.setServiceName(deploymentName);

        log.info("TTL 到期回收 runtime: runtimeId={} deployment={}", runtimeId, deploymentName);
        return k8sRuntimeOperator.delete(snapshot)
                .flatMap(deleted -> eventPublisher.publish(
                        RuntimeEventType.RECYCLED, snapshot, "TTL 到期自动回收"))
                .onErrorResume(err -> {
                    log.warn("runtime 回收失败(已忽略): runtimeId={} err={}", runtimeId, err.getMessage());
                    return Mono.empty();
                });
    }

    /**
     * 从 Deployment env 反查 userId (回收时 Redis 快照已过期删除).
     */
    private String readUserId(String namespace, String deploymentName) {
        try {
            Deployment deployment = kubernetesClient.apps().deployments()
                    .inNamespace(namespace).withName(deploymentName).get();
            if (deployment == null || deployment.getSpec() == null
                    || deployment.getSpec().getTemplate() == null
                    || deployment.getSpec().getTemplate().getSpec() == null
                    || deployment.getSpec().getTemplate().getSpec().getContainers() == null
                    || deployment.getSpec().getTemplate().getSpec().getContainers().isEmpty()) {
                return "";
            }
            return deployment.getSpec().getTemplate().getSpec().getContainers().get(0).getEnv().stream()
                    .filter(e -> "X_USER_ID".equals(e.getName()))
                    .map(io.fabric8.kubernetes.api.model.EnvVar::getValue)
                    .filter(Objects::nonNull)
                    .findFirst()
                    .orElse("");
        } catch (KubernetesClientException e) {
            if (e.getCode() != 404) {
                log.warn("读取 Deployment 用户信息失败: {} err={}", deploymentName, e.getMessage());
            }
            return "";
        }
    }
}
