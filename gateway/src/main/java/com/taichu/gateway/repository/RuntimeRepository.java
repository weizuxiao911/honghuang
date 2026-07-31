package com.honghuang.taixu.repository;

import com.honghuang.taixu.model.RuntimeSnapshot;
import reactor.core.publisher.Mono;

import java.util.Optional;

/**
 * Runtime 仓储端口 (SPI), 用 Redis 实现双索引 + TTL 自动过期.
 * 设计文档第三章: Redis 双索引存储 userId ⇄ runtimeId, TTL 过期自动触发闲置 Pod 回收.
 */
public interface RuntimeRepository {

    /**
     * 按 userId 查找 runtimeId.
     *
     * @param userId 用户 ID
     * @return runtimeId 快照 (若存在)
     */
    Mono<Optional<RuntimeSnapshot>> findByUserId(String userId);

    /**
     * 按 runtimeId 查找快照.
     *
     * @param runtimeId 运行时 ID
     * @return 快照 (若存在)
     */
    Mono<Optional<RuntimeSnapshot>> findByRuntimeId(String runtimeId);

    /**
     * 保存快照 (含 TTL 到期自动过期).
     *
     * @param snapshot 快照
     * @param ttlSeconds TTL 秒数
     * @return 保存后快照
     */
    Mono<RuntimeSnapshot> save(RuntimeSnapshot snapshot, long ttlSeconds);

    /**
     * 删除快照 (含双索引清理).
     *
     * @param runtimeId 运行时 ID
     * @return 是否删除成功
     */
    Mono<Boolean> delete(String runtimeId);

    /**
     * 刷新租约 (续期).
     *
     * @param runtimeId 运行时 ID
     * @param ttlSeconds TTL 秒数
     * @return 是否刷新成功
     */
    Mono<Boolean> renew(String runtimeId, long ttlSeconds);
}