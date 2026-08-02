package com.taichu.gateway.event;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.service.RuntimeRecycler;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.DisposableBean;
import org.springframework.data.redis.connection.ReactiveSubscription;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.Disposable;

/**
 * Redis keyspace 过期事件监听 (主回收链路).
 *
 * 设计文档第四章流程 6: TTL 过期 → Redis PUBLISH __keyevent@<db>__:expired →
 * gateway 订阅后触发 Pod 销毁 + PVC 巡检.
 *
 * 前提: Redis 需开启 notify-keyspace-events Ex (见 gateway/deploy/k8s/redis.yaml).
 * 收到过期 key 后仅处理运行时索引 (前缀 {prefix}:runtime:), 由 RuntimeRecycler 幂等回收.
 * gateway 多副本同时订阅同频道, 重复事件经幂等删除吸收, 无副作用.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RedisExpiryListener implements DisposableBean {

    private final ReactiveStringRedisTemplate redis;
    private final RuntimeRecycler runtimeRecycler;
    private final PlatformProperties gatewayProperties;

    private Disposable subscription;

    @PostConstruct
    public void start() {
        String prefix = gatewayProperties.getRedis().getKeyPrefix();
        String runtimeKeyPrefix = prefix + ":runtime:";
        // keyspace 通知频道含 db 下标 (__keyevent@0__:expired), 用通配避免硬编码 db.
        subscription = redis.listenToPattern("__keyevent@*__:expired")
                .map(ReactiveSubscription.Message::getMessage)
                .filter(key -> key.startsWith(runtimeKeyPrefix))
                .doOnNext(key -> {
                    String runtimeId = key.substring(runtimeKeyPrefix.length());
                    log.info("Redis TTL 到期触发回收: runtimeId={} key={}", runtimeId, key);
                    runtimeRecycler.recycle(runtimeId).subscribe();
                })
                .subscribe(
                        key -> { },
                        err -> log.error("keyspace 过期监听异常, 主链路降级, 依赖兜底巡检: {}", err.getMessage(), err));
        log.info("已订阅 Redis keyspace 过期通知: pattern=__keyevent@*__:expired prefix={}", runtimeKeyPrefix);
    }

    @Override
    public void destroy() {
        if (subscription != null) {
            subscription.dispose();
        }
    }
}
