package com.taichu.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Taichu gateway 调度平面：流量网关 + K8s 运行时编排中枢。
 *
 * 职责（按 设计文档.md 第三章）:
 *  - 流量网关: 收敛公网流量, 区分主域名平台接口与子域名运行实例路由
 *  - K8s 编排: 预置 Deployment/Service/PVC/HPA 模板, 按需创建用户独占 Pod
 *  - Redis 双索引: userId ⇄ runtimeId, TTL 自动过期
 *  - 反向代理: A2UI 请求经 SSE 转发至对应agent-image沙箱
 *  - 边界: 不渲染前端界面, 不解析 A2UI 业务协议, 不承载 Agent 业务执行逻辑
 *
 * 回收 (设计文档第四章流程 6):
 *  - 主链路: RedisExpiryListener 订阅 keyspace 过期通知
 *  - 兜底: RuntimeSweeper 定时巡检孤儿 Deployment (@EnableScheduling)
 */
@SpringBootApplication
@EnableScheduling
public class GatewayApplication {

    public static void main(String[] args) {
        SpringApplication.run(GatewayApplication.class, args);
    }
}