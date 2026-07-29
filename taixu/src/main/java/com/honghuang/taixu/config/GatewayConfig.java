package com.honghuang.taixu.config;

import org.springframework.context.annotation.Configuration;

/**
 * Spring Cloud Gateway 配置, 按 设计文档.md 第三章「taixu（太虚）」> 流量网关模块.
 *
 * 设计文档第三章:
 *   收敛全平台公网流量, 区分主域名平台接口、子域名运行实例路由.
 *   统一完成全局鉴权、用户/租户身份 Header 透传、接口限流、熔断降级、全链路日志、SSE 长连接透传.
 *
 * RuntimeRoutingFilter 与 AuthHeaderFilter 已标 @Component, 自动注册为 GlobalFilter.
 * Spring Cloud Gateway 原生支持 WebSocket (见 application.yml httpclient.websocket).
 */
@Configuration
public class GatewayConfig {
}