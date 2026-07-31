package com.taichu.gateway.model;

import lombok.Data;

import java.time.Instant;

/**
 * Runtime 运行快照, 反映 agent-image Pod 当前状态.
 * 按 设计文档.md 第三章: Redis 双索引存储 runtimeId ⇄ userId, TTL 自动过期.
 */
@Data
public class RuntimeSnapshot {

    /**
     * 运行时实例 ID (例: rt-{userId}-{suffix}).
     */
    private String runtimeId;

    /**
     * 用户 ID (来自上游 Header x-user-id).
     */
    private String userId;

    /**
     * 运行时状态 (running / stopped / pending / terminating).
     */
    private String status;

    /**
     * K8s 命名空间 (例: taichu-runtime).
     */
    private String namespace;

    /**
     * Deployment 名称 (例: gateway-rt-{userId}-{suffix}).
     */
    private String deploymentName;

    /**
     * Service 名称 (例: gateway-rt-{userId}-{suffix}).
     */
    private String serviceName;

    /**
     * 服务内网访问地址 (例: http://gateway-rt-{userId}-{suffix}.taichu-runtime.svc.cluster.local).
     */
    private String internalUrl;

    /**
     * 对外访问入口 (例: http://<runtimeId>.runtime.taichu.localhost/agent/).
     */
    private String agentApiBase;

    /**
     * 租约到期时间戳 (TTL 到期后回收).
     */
    private Instant leaseExpireAt;

    /**
     * 创建时间.
     */
    private Instant createdAt;

    /**
     * 更新时间.
     */
    private Instant updatedAt;
}