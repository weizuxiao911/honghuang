package com.taichu.gateway.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Taichu gateway 配置属性, 对应 application.yml 中 gateway.* 前缀.
 * 全字段中文注释, 与 设计文档.md 第三章「gateway（gateway）」对应.
 */
@Data
@ConfigurationProperties(prefix = "gateway")
public class PlatformProperties {

    /**
     * 运行时配置, 控制 agent-image Pod 生命周期与资源规格.
     */
    private Runtime runtime = new Runtime();

    /**
     * K8s 集群接入配置.
     */
    private Kubernetes kubernetes = new Kubernetes();

    /**
     * Redis 运行时仓储配置.
     */
    private Redis redis = new Redis();

    @Data
    public static class Runtime {
        /**
         * agent-image 镜像名 (例: agent-image:dev).
         */
        private String image;
        /**
         * 运行时空闲 TTL (秒), 到期后 Redis 过期触发回收.
         */
        private long ttl;
        /**
         * agent-image 容器内 opencode 监听端口 (固定 4096, 与 设计文档 第四章契约一致).
         */
        private Agent agent = new Agent();
        /**
         * Workspace PVC 名称 (设计文档第四章: NAS PVC 双 subPath 挂载).
         */
        private String workspacePvcClaimName;
        /**
         * PVC 子路径根目录 (例: workspaces).
         */
        private String workspacePvcSubPathRoot;
        /**
         * 项目工作目录容器内挂载点 (subPath {root}/{userId}/runtime).
         */
        private String workspaceMountPath;
        /**
         * opencode 私有状态挂载点 (subPath {root}/{userId}/global).
         */
        private String homeMountPath;
        /**
         * 代理转发 scheme (http / https).
         */
        private String scheme;
        /**
         * Sandbox 子域后缀 (例: runtime.taichu.localhost).
         * agentApiBase 按 runtimeId + runtimeHostSuffix 动态构造,
         * 设计文档第三章: gateway 调度层 + 单一子域转发.
         */
        private String runtimeHostSuffix;
        /**
         * Agent API 路径前缀 (例: /agent/).
         */
        private String agentPrefix;
        /**
         * 等待 Pod Ready 超时 (秒).
         */
        private int waitTimeoutSeconds;
        /**
         * Pod 状态轮询间隔 (毫秒).
         */
        private long pollIntervalMs;
        /**
         * SSE 心跳间隔 (秒). 默认 15s.
         */
        private long sseHeartbeatSeconds = 15;
        /**
         * SSE 续约间隔 (秒). 默认 120s; 需小于 ttl, 防止订阅期间 TTL 过期.
         */
        private long sseRenewalSeconds = 120;
        /**
         * 镜像拉取策略 (Always / IfNotPresent / Never).
         */
        private String imagePullPolicy;
        /**
         * 容器资源配额 (设计文档第三章: 1C1G 宽松).
         */
        private Resources resources = new Resources();
        /**
         * TTL 到期自动回收配置 (设计文档第四章流程 6: 过期自动触发 Pod 销毁 + PVC 巡检).
         * 主链路: Redis keyspace 过期通知 (notify-keyspace-events Ex) 触发实时回收.
         * 兜底: 定时巡检孤儿 Deployment (Redis 无索引且超过宽限期).
         */
        private Reclaim reclaim = new Reclaim();
    }

    @Data
    public static class Reclaim {
        /**
         * 兜底巡检开关 (默认 true).
         */
        private boolean sweepEnabled = true;
        /**
         * 兜底巡检间隔 (秒). 默认 300s.
         */
        private long sweepIntervalSeconds = 300;
        /**
         * 启动后首轮巡检延迟 (秒). 默认 30s, 等应用完全就绪.
         */
        private long sweepInitialDelaySeconds = 30;
        /**
         * 孤儿宽限期 (秒): Deployment 创建时间超过该值且 Redis 无索引才回收.
         * 默认与 ttl 一致, 防止创建过程中被误判为孤儿.
         */
        private long sweepGraceSeconds = 600;
    }

    @Data
    public static class Agent {
        /**
         * opencode 监听端口.
         */
        private int port;
    }

    @Data
    public static class Resources {
        private Resource requests = new Resource();
        private Resource limits = new Resource();
    }

    @Data
    public static class Resource {
        private String cpu;
        private String memory;
    }

    @Data
    public static class Kubernetes {
        /**
         * K8s 集群名称 (多集群时区分).
         */
        private String cluster;
        /**
         * 运行时命名空间 (设计文档第三章: 用户独立 Pod 按租户隔离).
         */
        private String namespace;
        /**
         * Service DNS 后缀.
         */
        private String dnsSuffix;
    }

    @Data
    public static class Redis {
        /**
         * Redis 键前缀, 用于双索引: userId -> runtimeId 与 runtimeId -> userId.
         */
        private String keyPrefix;
    }
}