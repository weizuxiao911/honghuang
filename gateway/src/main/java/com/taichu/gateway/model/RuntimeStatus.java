package com.taichu.gateway.model;

import lombok.Getter;

/**
 * Runtime 状态机 - 与 Redis 索引同步的字符串值.
 *
 * 状态流转:
 * <pre>
 *   PENDING → CREATING → RUNNING → READY
 *                ↓          ↓        ↓
 *              FAILED     FAILED   TERMINATING → TERMINATED
 * </pre>
 *
 * 字段存储用 {@link #name()} 字符串, 与设计文档第三章 Redis 双索引的 status 字段保持一致.
 * yunyan-agent AgentRuntimeService 状态机参考.
 */
@Getter
public enum RuntimeStatus {
    /** 收到创建请求, 等待 K8s operator 调度. */
    PENDING("待调度"),
    /** K8s operator 已开始创建 Deployment. */
    CREATING("创建中"),
    /** Pod 已 Running (K8s 探针通过). */
    RUNNING("Pod 已启动"),
    /** sandbox 内部 /global/health 返 200, 业务可访问. */
    READY("已就绪"),
    /** 任意环节失败. */
    FAILED("失败"),
    /** TTL 到期 / 收到删除请求, 正在清理. */
    TERMINATING("清理中"),
    /** 已释放 K8s 资源, Redis 索引已删除. */
    TERMINATED("已回收");

    private final String description;

    RuntimeStatus(String description) {
        this.description = description;
    }
}