package com.taichu.gateway.event;

import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

/**
 * SSE 连接租约续约器.
 *
 * SSE 长连接期间每 {@code sseRenewalSeconds} 自动续约 runtime, 防止客户端订阅期间 TTL 过期回收.
 * yunyan-agent SseLeaseRenewer 字段对照.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SseLeaseRenewer {

    private final RuntimeRepository repository;
    private final PlatformProperties config;
    private final EventPublisher eventPublisher;

    /**
     * 续约指定用户当前的 runtime 租约, 发布 RENEWED 事件.
     */
    public Mono<Void> renew(String userId) {
        return repository.findByUserId(userId)
                .flatMap(opt -> opt.map(snapshot -> renewOne(snapshot)).orElse(Mono.empty()))
                .doOnSuccess(v -> log.debug("租约已续约: userId={}", userId))
                .then();
    }

    private Mono<Void> renewOne(com.taichu.gateway.model.RuntimeSnapshot snapshot) {
        long ttl = config.getRuntime().getTtl();
        long threshold = config.getRuntime().effectiveRenewThresholdSeconds();
        return repository.renewIfLow(snapshot, threshold, ttl)
                .filter(Boolean::booleanValue)
                .flatMap(renewed -> eventPublisher.publish(RuntimeEventType.RENEWED, snapshot, "租约已续约"))
                .then();
    }
}