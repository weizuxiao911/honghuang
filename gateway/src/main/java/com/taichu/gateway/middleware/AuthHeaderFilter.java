package com.taichu.gateway.middleware;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

/**
 * 鉴权 Header 透传过滤器, 按 设计文档.md 第三章「gateway（gateway）」.
 *
 * 设计文档第三章:
 *   统一完成全局鉴权、用户/租户身份 Header 透传、接口限流、熔断降级、全链路日志、SSE 长连接透传.
 *
 * 逻辑:
 *  1. 上游入口 (app 浏览器) 已带 x-user-id / x-tenant-id (由 registry/认证服务注入).
 *  2. 本网关不自行鉴权, 只透明透传到下游 agent-image.
 *  3. 缺失 x-user-id 时打 401 (但当前不实施完整鉴权, 后续接 gateway 鉴权服务).
 *
 * 边界: 不硬编码凭据, 不维护登录态, 不解析 token.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AuthHeaderFilter implements GlobalFilter, Ordered {

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE + 1;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String userId = request.getHeaders().getFirst("x-user-id");
        String tenantId = request.getHeaders().getFirst("x-tenant-id");

        log.debug("鉴权透传: x-user-id={} x-tenant-id={}", userId, tenantId);

        // 本地 master API 必须带 x-user-id (按 RuntimeController 约定)
        if (request.getPath().value().startsWith("/runtime") && userId == null) {
            log.warn("缺失 x-user-id Header: {}", request.getPath().value());
            exchange.getResponse().setStatusCode(org.springframework.http.HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        return chain.filter(exchange);
    }
}