package com.taichu.gateway.service;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.model.RuntimeSnapshot;
import io.fabric8.kubernetes.api.model.Pod;
import io.fabric8.kubernetes.api.model.ServiceAccount;
import io.fabric8.kubernetes.api.model.ServiceAccountBuilder;
import io.fabric8.kubernetes.api.model.apps.Deployment;
import io.fabric8.kubernetes.api.model.apps.DeploymentBuilder;
import io.fabric8.kubernetes.client.KubernetesClient;
import io.fabric8.kubernetes.client.KubernetesClientException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import reactor.core.scheduler.Schedulers;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

/**
 * K8s 运行时操作实现, 用 Fabric8 客户端管理 agent-image Pod 生命周期.
 *
 * 设计文档第三章:
 *   预置标准化 Deployment、Service、PVC、HPA 资源模板, 接收前端指令后动态创建用户独立 Pod.
 *
 * 设计文档第四章 (agent-image 契约):
 *   PVC 双 subPath 挂载: workspace + config/data
 *   环境变量注入: 用户身份 (x-user-id, x-tenant-id)
 *   镜像: agent-image:dev (或 gateway 注入的 image)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class K8sRuntimeOperatorImpl implements K8sRuntimeOperator {

    private final KubernetesClient kubernetesClient;
    private final PlatformProperties gatewayProperties;

    @Override
    public Mono<RuntimeSnapshot> create(RuntimeSnapshot snapshot) {
        return Mono.fromCallable(() -> doCreate(snapshot))
                .subscribeOn(Schedulers.boundedElastic());
    }

    @Override
    public Mono<Boolean> delete(RuntimeSnapshot snapshot) {
        return Mono.fromCallable(() -> doDelete(snapshot))
                .subscribeOn(Schedulers.boundedElastic());
    }

    /**
     * 等待运行时 Pod Ready: 先 list 防竞态 (watch 建立前可能已就绪), 未就绪则用 K8s Watch
     * 监听 runtimeId 标签对应的 Pod, condition Ready=True 即返回. 超时按 wait-timeout-seconds.
     */
    @Override
    public Mono<RuntimeSnapshot> waitForPodReady(RuntimeSnapshot snapshot) {
        String namespace = snapshot.getNamespace();
        String runtimeId = snapshot.getRuntimeId();
        long timeoutSec = gatewayProperties.getRuntime().getWaitTimeoutSeconds();
        log.info("watch 等待 pod Ready: runtimeId={} namespace={} timeout={}s", runtimeId, namespace, timeoutSec);

        return Mono.<RuntimeSnapshot>create(sink -> {
            java.util.concurrent.atomic.AtomicBoolean done = new java.util.concurrent.atomic.AtomicBoolean(false);
            boolean alreadyReady = kubernetesClient.pods().inNamespace(namespace)
                    .withLabel("runtimeId", runtimeId)
                    .list().getItems().stream().anyMatch(this::podReady);
            if (alreadyReady) {
                log.info("pod 已就绪 (list 命中): runtimeId={}", runtimeId);
                sink.success(snapshot);
                return;
            }
            final io.fabric8.kubernetes.client.Watch[] watchRef = new io.fabric8.kubernetes.client.Watch[1];
            watchRef[0] = kubernetesClient.pods().inNamespace(namespace)
                    .withLabel("runtimeId", runtimeId)
                    .watch(new io.fabric8.kubernetes.client.Watcher<>() {
                        @Override
                        public void eventReceived(Action action, Pod pod) {
                            if (podReady(pod)) {
                                log.info("pod Ready (watch 命中): runtimeId={} pod={} action={}",
                                        runtimeId, pod.getMetadata().getName(), action);
                                if (done.compareAndSet(false, true)) {
                                    sink.success(snapshot);
                                }
                                watchRef[0].close();
                            }
                        }

                        @Override
                        public void onClose(io.fabric8.kubernetes.client.WatcherException cause) {
                            if (cause != null && done.compareAndSet(false, true)) {
                                sink.error(cause);
                            }
                        }
                    });
            sink.onDispose(watchRef[0]::close);
        }).timeout(Duration.ofSeconds(timeoutSec))
          .onErrorResume(err -> {
              if (err instanceof java.util.concurrent.TimeoutException) {
                  log.error("watch pod Ready 超时: runtimeId={} ({}s)", runtimeId, timeoutSec);
              }
              return Mono.error(err);
          });
    }

    private boolean podReady(Pod pod) {
        if (pod.getStatus() == null || pod.getStatus().getConditions() == null) {
            return false;
        }
        return pod.getStatus().getConditions().stream()
                .anyMatch(c -> "Ready".equals(c.getType()) && "True".equals(c.getStatus()));
    }

    @Override
    public Mono<RuntimeSnapshot> refresh(RuntimeSnapshot snapshot) {
        return Mono.fromCallable(() -> doRefresh(snapshot))
                .subscribeOn(Schedulers.boundedElastic());
    }

    @Override
    public Mono<RuntimeSnapshot> restart(RuntimeSnapshot snapshot) {
        return Mono.fromCallable(() -> {
                    doDelete(snapshot);
                    RuntimeSnapshot restarted = doCreate(snapshot);
                    restarted.setCreatedAt(Instant.now());
                    restarted.setUpdatedAt(Instant.now());
                    return restarted;
                })
                .subscribeOn(Schedulers.boundedElastic());
    }

    private RuntimeSnapshot doCreate(RuntimeSnapshot snapshot) {
        String namespace = gatewayProperties.getKubernetes().getNamespace();
        String runtimeId = snapshot.getRuntimeId();

        log.info("创建 Deployment: namespace={} runtimeId={} image={}", namespace, runtimeId, gatewayProperties.getRuntime().getImage());

        // 1. 创建 ServiceAccount (按用户隔离, RBAC 最小权限)
        ServiceAccount sa = new ServiceAccountBuilder()
                .withNewMetadata()
                .withName("runtime-" + runtimeId)
                .withNamespace(namespace)
                .withLabels(labels(runtimeId))
                .endMetadata()
                .build();

        try {
            kubernetesClient.serviceAccounts().inNamespace(namespace).resource(sa).create();
            log.info("ServiceAccount 已创建: {}", sa.getMetadata().getName());
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                log.warn("ServiceAccount 已存在: {}", sa.getMetadata().getName());
            } else {
                throw e;
            }
        }

        // 2. 创建 Deployment (按 设计文档 第四章 agent-image 契约)
        PlatformProperties.Runtime runtime = gatewayProperties.getRuntime();
        Deployment deployment = new DeploymentBuilder()
                .withNewMetadata()
                .withName(snapshot.getDeploymentName())
                .withNamespace(namespace)
                .withLabels(labels(runtimeId))
                .endMetadata()
                .withNewSpec()
                .withReplicas(1)
                .withNewSelector()
                .withMatchLabels(labels(runtimeId))
                .endSelector()
                .withNewTemplate()
                .withNewMetadata()
                .withLabels(labels(runtimeId))
                .endMetadata()
                .withNewSpec()
                .withServiceAccountName("runtime-" + runtimeId)
                .addNewContainer()
                .withName("agent-image")
                .withImage(runtime.getImage())
                .withImagePullPolicy(runtime.getImagePullPolicy())
                .withPorts(java.util.Collections.singletonList(
                        new io.fabric8.kubernetes.api.model.ContainerPortBuilder()
                                .withName("agent")
                                .withContainerPort(runtime.getAgent().getPort())
                                .build()
                ))
                .withNewReadinessProbe()
                .withNewHttpGet()
                .withPath("/global/health")
                .withPort(new io.fabric8.kubernetes.api.model.IntOrString(runtime.getAgent().getPort()))
                .endHttpGet()
                .withInitialDelaySeconds(0)
                .withPeriodSeconds(1)
                .withTimeoutSeconds(1)
                .withFailureThreshold(3)
                .endReadinessProbe()
                .withNewResources()
                .withRequests(Map.of(
                        "cpu", io.fabric8.kubernetes.api.model.Quantity.parse(runtime.getResources().getRequests().getCpu()),
                        "memory", io.fabric8.kubernetes.api.model.Quantity.parse(runtime.getResources().getRequests().getMemory())
                ))
                .withLimits(Map.of(
                        "cpu", io.fabric8.kubernetes.api.model.Quantity.parse(runtime.getResources().getLimits().getCpu()),
                        "memory", io.fabric8.kubernetes.api.model.Quantity.parse(runtime.getResources().getLimits().getMemory())
                ))
                .endResources()
                .addNewEnv()
                .withName("OPENCODE_PORT")
                .withValue(String.valueOf(runtime.getAgent().getPort()))
                .endEnv()
                .addNewEnv()
                .withName("X_USER_ID")
                .withValue(snapshot.getUserId())
                .endEnv()
                .addNewVolumeMount()
                .withName("workspace")
                .withMountPath(runtime.getWorkspaceMountPath())
                .withSubPath(runtime.getWorkspacePvcSubPathRoot() + "/" + snapshot.getUserId() + "/runtime")
                .endVolumeMount()
                .addNewVolumeMount()
                .withName("workspace")
                .withMountPath(runtime.getHomeMountPath())
                .withSubPath(runtime.getWorkspacePvcSubPathRoot() + "/" + snapshot.getUserId() + "/global")
                .endVolumeMount()
                .endContainer()
                .addNewVolume()
                .withName("workspace")
                .withNewPersistentVolumeClaim()
                .withClaimName(runtime.getWorkspacePvcClaimName())
                .endPersistentVolumeClaim()
                .endVolume()
                .endSpec()
                .endTemplate()
                .endSpec()
                .build();

        try {
            kubernetesClient.apps().deployments().inNamespace(namespace).resource(deployment).create();
            log.info("Deployment 已创建: {}", deployment.getMetadata().getName());
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                log.warn("Deployment 已存在: {}", deployment.getMetadata().getName());
            } else {
                throw e;
            }
        }

        // 3. 创建 Service
        io.fabric8.kubernetes.api.model.Service service = new io.fabric8.kubernetes.api.model.ServiceBuilder()
                .withNewMetadata()
                .withName(snapshot.getServiceName())
                .withNamespace(namespace)
                .withLabels(labels(runtimeId))
                .endMetadata()
                .withNewSpec()
                .withSelector(labels(runtimeId))
                .addNewPort()
                .withName("agent")
                .withPort(80)
                .withTargetPort(new io.fabric8.kubernetes.api.model.IntOrString(runtime.getAgent().getPort()))
                .endPort()
                .endSpec()
                .build();

        try {
            kubernetesClient.services().inNamespace(namespace).resource(service).create();
            log.info("Service 已创建: {}", service.getMetadata().getName());
        } catch (KubernetesClientException e) {
            if (e.getCode() == 409) {
                log.warn("Service 已存在: {}", service.getMetadata().getName());
            } else {
                throw e;
            }
        }

        // status 由调用方 RuntimeService 状态机管理 (PENDING -> CREATING -> RUNNING -> READY).
        snapshot.setUpdatedAt(Instant.now());
        return snapshot;
    }

    private Boolean doDelete(RuntimeSnapshot snapshot) {
        String namespace = gatewayProperties.getKubernetes().getNamespace();
        String deploymentName = snapshot.getDeploymentName();
        String serviceName = snapshot.getServiceName();

        log.info("删除 Deployment: namespace={} name={}", namespace, deploymentName);

        try {
            kubernetesClient.apps().deployments().inNamespace(namespace).withName(deploymentName).delete();
            kubernetesClient.services().inNamespace(namespace).withName(serviceName).delete();
            log.info("已删除: {} {}", deploymentName, serviceName);
            return true;
        } catch (KubernetesClientException e) {
            if (e.getCode() == 404) {
                log.warn("资源不存在, 已忽略: {} {}", deploymentName, serviceName);
                return true;
            }
            throw e;
        }
    }

    private RuntimeSnapshot doRefresh(RuntimeSnapshot snapshot) {
        String namespace = gatewayProperties.getKubernetes().getNamespace();
        String deploymentName = snapshot.getDeploymentName();

        try {
            Deployment deployment = kubernetesClient.apps().deployments().inNamespace(namespace).withName(deploymentName).get();
            if (deployment != null && deployment.getStatus() != null) {
                Integer available = deployment.getStatus().getAvailableReplicas();
                Integer ready = deployment.getStatus().getReadyReplicas();
                snapshot.setStatus(available != null && available > 0 ? "running" : "pending");
            } else {
                snapshot.setStatus("terminated");
            }
        } catch (KubernetesClientException e) {
            if (e.getCode() == 404) {
                snapshot.setStatus("terminated");
            } else {
                throw e;
            }
        }

        snapshot.setUpdatedAt(Instant.now());
        return snapshot;
    }

    private Map<String, String> labels(String runtimeId) {
        Map<String, String> labels = new HashMap<>();
        labels.put("app", "gateway");
        labels.put("runtimeId", runtimeId);
        labels.put("tenantId", "default");
        return labels;
    }
}