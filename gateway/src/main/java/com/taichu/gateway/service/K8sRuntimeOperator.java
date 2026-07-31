package com.taichu.gateway.service;

import com.taichu.gateway.model.RuntimeSnapshot;
import reactor.core.publisher.Mono;

/**
 * K8s 运行时操作端口 (SPI), 封装 agent-image Pod 生命周期管理.
 * 设计文档第三章: 预置 Deployment/Service/PVC/HPA 模板, 按需创建用户独占 Pod.
 */
public interface K8sRuntimeOperator {

    /**
     * 创建运行时 (Deployment + Service).
     *
     * @param snapshot 运行时快照
     * @return 创建后快照
     */
    Mono<RuntimeSnapshot> create(RuntimeSnapshot snapshot);

    /**
     * 删除运行时 (Deployment + Service).
     *
     * @param snapshot 运行时快照
     * @return 是否删除成功
     */
    Mono<Boolean> delete(RuntimeSnapshot snapshot);

    /**
     * 查询运行时状态.
     *
     * @param snapshot 运行时快照
     * @return 最新快照 (含 status)
     */
    Mono<RuntimeSnapshot> refresh(RuntimeSnapshot snapshot);

    /**
     * 等待运行时 Pod Ready (K8s Watch 监听, 非轮询).
     * Pod 就绪条件 = condition Ready=True; 超时由实现侧按 wait-timeout-seconds 处理.
     *
     * @param snapshot 运行时快照
     * @return 就绪后快照
     */
    Mono<RuntimeSnapshot> waitForPodReady(RuntimeSnapshot snapshot);

    /**
     * 重启运行时 (通过删除 + 重建).
     *
     * @param snapshot 运行时快照
     * @return 新快照
     */
    Mono<RuntimeSnapshot> restart(RuntimeSnapshot snapshot);
}