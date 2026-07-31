package com.taichu.gateway.controller;

import com.taichu.gateway.event.SseEventStream;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.service.RuntimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

/**
 * 运行时 Master API, 按 设计文档.md 第三章「gateway（gateway）」.
 * 设计文档第三章: 接收前端指令后动态创建用户独立 Pod.
 *
 * 路由:
 *   POST   /runtime        创建 Runtime
 *   GET    /runtime        查询当前用户的 Runtime
 *   GET    /runtime/events SSE 事件流 (状态广播)
 *   DELETE /runtime        删除 Runtime
 *   POST   /runtime/restart  重启 Runtime
 *
 * Header 约定 (全小写, 与 设计文档 第三章一致):
 *   x-user-id    用户 ID (gateway 网关注入, 不自行维护登录态)
 *   x-tenant-id  租户 ID (可选, 用于多租户隔离)
 */
@RestController
@RequestMapping("/runtime")
@RequiredArgsConstructor
public class RuntimeController {

    private final RuntimeService runtimeService;
    private final SseEventStream sseEventStream;

    /**
     * 创建 Runtime.
     */
    @PostMapping
    public Mono<ResponseEntity<RuntimeSnapshot>> create(@RequestHeader("x-user-id") String userId) {
        return runtimeService.create(userId)
                .map(snapshot -> ResponseEntity.status(HttpStatus.CREATED).body(snapshot))
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null)));
    }

    /**
     * 查询当前用户的 Runtime.
     */
    @GetMapping
    public Mono<ResponseEntity<RuntimeSnapshot>> get(@RequestHeader("x-user-id") String userId) {
        return runtimeService.findByUserId(userId)
                .map(ResponseEntity::ok)
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null)));
    }

    /**
     * SSE 平台事件流. yunyan-agent 同模式: 4 子流 (initial / events / heartbeat / renewal).
     * 客户端订阅以被动感知 runtime 状态变更, 避免轮询 /global/health.
     *
     * EventSource 浏览器限制不能设自定义 header, 故 userId / runtimeId 通过 query param 传递.
     */
    @GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<org.springframework.http.codec.ServerSentEvent<String>> streamEvents(
            @RequestHeader(value = "x-user-id", required = false) String userIdHeader,
            @RequestParam(value = "userId", required = false) String userIdParam) {
        String userId = userIdHeader != null ? userIdHeader : userIdParam;
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("userId is required (x-user-id header or ?userId=)");
        }
        return sseEventStream.buildForUser(userId);
    }

    /**
     * 删除 Runtime.
     */
    @DeleteMapping
    public Mono<ResponseEntity<Void>> delete(@RequestHeader("x-user-id") String userId) {
        return runtimeService.delete(userId)
                .map(deleted -> deleted
                        ? ResponseEntity.noContent().<Void>build()
                        : ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).<Void>build())
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).<Void>build()));
    }

    /**
     * 重启 Runtime.
     */
    @PostMapping("/restart")
    public Mono<ResponseEntity<RuntimeSnapshot>> restart(@RequestHeader("x-user-id") String userId) {
        return runtimeService.restart(userId)
                .map(ResponseEntity::ok)
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null)));
    }
}