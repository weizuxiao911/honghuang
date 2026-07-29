package com.honghuang.taixu.middleware;

import com.honghuang.taixu.config.TaixuProperties;
import com.honghuang.taixu.model.RuntimeSnapshot;
import com.honghuang.taixu.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.URI;

import static org.springframework.cloud.gateway.support.ServerWebExchangeUtils.GATEWAY_REQUEST_URL_ATTR;

/**
 * 运行时路由过滤器, 按 设计文档.md 第三章「taixu（太虚）」> 双通道寻址规则.
 *
 * 设计文档第三章:
 *   同源请求: 依靠 x-runtime-id Header 定位运行实例
 *   跨端跳转: 依靠子域名 Host 匹配路由
 *
 * 逻辑:
 *  1. /agent/* 路径 -> 解析 x-runtime-id Header -> 查 Redis -> 转发到对应 dongfu
 *  2. {runtimeId}.localhost/* 子域名 -> 查 Redis -> 转发到对应 dongfu
 *  3. 其它路径 (/runtime/*, /health) -> 透传至本地 master API
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RuntimeRoutingFilter implements GlobalFilter, Ordered {

    private final RuntimeRepository runtimeRepository;
    private final TaixuProperties taixuProperties;

    @Override
    public int getOrder() {
        return Ordered.HIGHEST_PRECEDENCE;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getPath().value();
        String host = request.getURI().getHost();

        log.debug("路由请求: host={} path={} headers={}", host, path, request.getHeaders().keySet());

        // 1. 本地 master API (/runtime/*, /health)
        if (path.startsWith("/runtime") || path.equals("/health")) {
            return chain.filter(exchange);
        }

        // 2. 子域名 WebUI 路由: {runtimeId}.localhost/*
        String runtimeIdFromHost = extractRuntimeIdFromHost(host);
        if (runtimeIdFromHost != null) {
            return routeToRuntime(exchange, chain, runtimeIdFromHost, host, path);
        }

        // 3. Agent API 路由: /agent/* -> 解析 x-runtime-id Header
        String runtimeIdFromHeader = request.getHeaders().getFirst("x-runtime-id");
        if (path.startsWith("/agent") && runtimeIdFromHeader != null) {
            // 去掉 /agent 前缀, 转发到 dongfu 的 / 根路径
            String strippedPath = path.substring("/agent".length());
            if (!strippedPath.startsWith("/")) {
                strippedPath = "/" + strippedPath;
            }
            return routeToRuntime(exchange, chain, runtimeIdFromHeader, host, strippedPath);
        }

        // 4. 兜底: 透传 (no://op)
        log.warn("未匹配路由: host={} path={}", host, path);
        return chain.filter(exchange);
    }

    /**
     * 从 Host 提取 runtimeId (子域名解析).
     * 例: rt-abc123.localhost -> rt-abc123
     */
    private String extractRuntimeIdFromHost(String host) {
        if (host == null) {
            return null;
        }
        String[] parts = host.split("\\.");
        if (parts.length >= 2 && parts[0].startsWith("rt-")) {
            return parts[0];
        }
        return null;
    }

    /**
     * 按 runtimeId 查 Redis -> 转发到对应 dongfu.
     */
    private Mono<Void> routeToRuntime(ServerWebExchange exchange, GatewayFilterChain chain,
                                      String runtimeId, String host, String path) {
        return runtimeRepository.findByRuntimeId(runtimeId)
                .flatMap(opt -> {
                    if (opt.isEmpty()) {
                        log.warn("运行时未找到: runtimeId={}", runtimeId);
                        exchange.getResponse().setStatusCode(HttpStatus.NOT_FOUND);
                        return exchange.getResponse().setComplete();
                    }

                    RuntimeSnapshot snapshot = opt.get();
                    String targetUrl = snapshot.getInternalUrl() + path;
                    try {
                        URI targetUri = URI.create(targetUrl);
                        exchange.getAttributes().put(GATEWAY_REQUEST_URL_ATTR, targetUri);
                        log.info("路由转发: runtimeId={} -> {}", runtimeId, targetUri);
                        return chain.filter(exchange);
                    } catch (Exception e) {
                        log.error("构建转发 URI 失败: runtimeId={} target={}", runtimeId, targetUrl, e);
                        exchange.getResponse().setStatusCode(HttpStatus.INTERNAL_SERVER_ERROR);
                        return exchange.getResponse().setComplete();
                    }
                });
    }
}