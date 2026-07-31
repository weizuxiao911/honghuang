package com.taichu.gateway.controller;

import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.service.RuntimeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

/**
 * 运行时 Master API, 按 设计文档.md 第三章「gateway（gateway）」.
 * 设计文档第三章: 接收前端指令后动态创建用户独立 Pod.
 *
 * 路由:
 *   POST   /runtime        创建 Runtime
 *   GET    /runtime        查询当前用户的 Runtime
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

    /**
     * 创建 Runtime.
     *
     * @param userId 用户 ID (来自 x-user-id Header)
     * @return 运行时快照
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
     *
     * @param userId 用户 ID
     * @return 运行时快照
     */
    @GetMapping
    public Mono<ResponseEntity<RuntimeSnapshot>> get(@RequestHeader("x-user-id") String userId) {
        return runtimeService.findByUserId(userId)
                .map(ResponseEntity::ok)
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null)));
    }

    /**
     * 删除 Runtime.
     *
     * @param userId 用户 ID
     * @return 删除结果
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
     *
     * @param userId 用户 ID
     * @return 新快照
     */
    @PostMapping("/restart")
    public Mono<ResponseEntity<RuntimeSnapshot>> restart(@RequestHeader("x-user-id") String userId) {
        return runtimeService.restart(userId)
                .map(ResponseEntity::ok)
                .onErrorResume(RuntimeService.RuntimeNotFoundException.class,
                        e -> Mono.just(ResponseEntity.status(HttpStatus.NOT_FOUND).body(null)));
    }
}