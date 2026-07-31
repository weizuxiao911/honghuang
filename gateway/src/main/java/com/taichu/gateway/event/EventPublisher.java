package com.taichu.gateway.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.model.RuntimeStatus;
import com.taichu.gateway.model.SseEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.ReactiveSubscription;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * SSE 事件发布/订阅服务.
 *
 * 通过 Redis Pub/Sub channel "taichu-runtime:events" 广播状态变更.
 * 设计文档第三章: Redis 双索引 + 状态广播.
 * yunyan-agent EventPublisher 字段对照.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventPublisher {

    private final ReactiveStringRedisTemplate redis;
    private final ObjectMapper objectMapper;

    private static final String EVENT_CHANNEL = "taichu-runtime:events";

    /**
     * 发布平台事件.
     */
    public Mono<Void> publish(RuntimeEventType type, String userId, String runtimeId) {
        return publish(type, userId, runtimeId, (RuntimeStatus) null, type.getDefaultDescription());
    }

    /**
     * 发布平台事件（自定义描述）.
     */
    public Mono<Void> publish(RuntimeEventType type, String userId, String runtimeId, String message) {
        return publish(type, userId, runtimeId, (RuntimeStatus) null, message);
    }

    /**
     * 发布平台事件（带状态）.
     */
    public Mono<Void> publish(RuntimeEventType type, String userId, String runtimeId,
                              RuntimeStatus status, String message) {
        SseEvent event = SseEvent.builder()
                .id(UUID.randomUUID().toString().substring(0, 8))
                .type(type.name())
                .userId(userId)
                .runtimeId(runtimeId)
                .status(status != null ? status.name() : null)
                .message(message)
                .timestamp(Instant.now())
                .build();

        return redis.convertAndSend(EVENT_CHANNEL, toJson(event))
                .doOnSuccess(subscribers -> log.debug("事件已发布: type={}, userId={}, subscribers={}", type, userId, subscribers))
                .then();
    }

    /**
     * 从 RuntimeSnapshot 构造并发布事件.
     */
    public Mono<Void> publish(RuntimeEventType type, RuntimeSnapshot snapshot, String message) {
        RuntimeStatus status = snapshot.getStatus() != null
                ? RuntimeStatus.valueOf(snapshot.getStatus().toUpperCase())
                : null;
        return publish(type, snapshot.getUserId(), snapshot.getRuntimeId(), status, message);
    }

    /**
     * 订阅事件通道, 返回原始消息流.
     */
    public Flux<String> subscribeToEvents() {
        return redis.listenToChannel(EVENT_CHANNEL)
                .map(ReactiveSubscription.Message::getMessage);
    }

    private String toJson(SseEvent event) {
        try {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", event.getId());
            map.put("type", event.getType());
            map.put("userId", event.getUserId());
            map.put("runtimeId", event.getRuntimeId());
            if (event.getStatus() != null) {
                map.put("status", event.getStatus());
            }
            map.put("message", event.getMessage());
            map.put("timestamp", event.getTimestamp().toString());
            return objectMapper.writeValueAsString(map);
        } catch (JsonProcessingException e) {
            log.error("序列化 SSE 事件失败", e);
            return "{}";
        }
    }
}