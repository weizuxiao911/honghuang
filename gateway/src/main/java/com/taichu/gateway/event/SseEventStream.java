package com.taichu.gateway.event;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.taichu.gateway.config.PlatformProperties;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * SSE 事件流编排器.
 *
 * 合并三个子流:
 * <ul>
 *   <li>initial state: 连接建立时立即推送当前 runtime 快照 (status=INITIAL_STATE)</li>
 *   <li>events: Redis Pub/Sub 订阅 → 过滤 userId → 格式化</li>
 *   <li>heartbeat: 周期性 SSE comment 维持长连接</li>
 * </ul>
 *
 * 续约不再走 SSE 专用子流: 数据平面流量续约 (RuntimeRoutingFilter) 已覆盖
 * 所有走 runtime 的请求 (含 sandbox 内 SSE 流), 订阅期间 TTL 不会被过期回收.
 *
 * Spring WebFlux 要求返回 {@link ServerSentEvent} 才能正确生成标准 SSE 协议
 * (event:/id:/data:), 直接返回 Flux&lt;String&gt; 会被当作 text/event-stream 模式
 * 自动给每行加 data: 前缀, 破坏协议.
 *
 * yunyan-agent SseEventStream 字段对照.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SseEventStream {

    private final EventPublisher eventPublisher;
    private final SseEventFormatter formatter;
    private final RuntimeRepository repository;
    private final ObjectMapper objectMapper;
    private final PlatformProperties config;

    /**
     * 构建指定用户的 SSE 事件流. 连接断开时所有子流自动停止.
     */
    public Flux<ServerSentEvent<String>> buildForUser(String userId) {
        long heartbeatSec = config.getRuntime().getSseHeartbeatSeconds();

        Flux<ServerSentEvent<String>> events = eventPublisher.subscribeToEvents()
                .filter(msg -> formatter.isForUser(msg, userId))
                .map(this::toSseEvent);

        Flux<ServerSentEvent<String>> heartbeats = Flux.interval(Duration.ofSeconds(heartbeatSec))
                .map(tick -> ServerSentEvent.<String>builder().comment("heartbeat").build());

        Flux<ServerSentEvent<String>> initialState = buildInitialState(userId);

        return Flux.concat(initialState, Flux.merge(events, heartbeats))
                .doOnSubscribe(s -> log.info("SSE 连接建立: userId={}", userId))
                .doFinally(signal -> log.info("SSE 连接关闭: userId={}, signal={}", userId, signal));
    }

    private ServerSentEvent<String> toSseEvent(String json) {
        try {
            Map<String, Object> map = objectMapper.readValue(json, Map.class);
            String type = (String) map.getOrDefault("type", "UNKNOWN");
            String id = (String) map.getOrDefault("id", null);
            return ServerSentEvent.<String>builder()
                    .id(id)
                    .event(type)
                    .data(json)
                    .build();
        } catch (Exception e) {
            log.warn("解析 SSE 事件失败: {}", e.getMessage());
            return ServerSentEvent.<String>builder().event("ERROR").data("{}").build();
        }
    }

    private Flux<ServerSentEvent<String>> buildInitialState(String userId) {
        return repository.findByUserId(userId)
                .flatMap(opt -> opt.map(this::buildInitialEvent).orElseGet(Mono::empty))
                .flux();
    }

    private Mono<ServerSentEvent<String>> buildInitialEvent(RuntimeSnapshot snapshot) {
        Map<String, Object> map = new LinkedHashMap<>();
        String id = UUID.randomUUID().toString().substring(0, 8);
        map.put("id", id);
        map.put("type", RuntimeEventType.INITIAL_STATE.name());
        map.put("userId", snapshot.getUserId());
        map.put("runtimeId", snapshot.getRuntimeId());
        if (snapshot.getStatus() != null) {
            map.put("status", snapshot.getStatus());
        }
        map.put("message", RuntimeEventType.INITIAL_STATE.getDefaultDescription());
        map.put("timestamp", Instant.now().toString());

        try {
            String json = objectMapper.writeValueAsString(map);
            return Mono.just(ServerSentEvent.<String>builder()
                    .id(id)
                    .event(RuntimeEventType.INITIAL_STATE.name())
                    .data(json)
                    .build());
        } catch (JsonProcessingException e) {
            log.error("构造 INITIAL_STATE 失败", e);
            return Mono.empty();
        }
    }
}