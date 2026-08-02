package com.taichu.gateway.repository;

import com.taichu.gateway.model.RuntimeSnapshot;
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
     * 增量续约 (原子, Lua): 节流窗口内跳过; 否则剩余 TTL 不足 {@code thresholdSeconds}
     * 时续满为 {@code ttlSeconds}. 节流状态存 Redis, 多副本共享.
     * 设计文档第四章流程 6: 续约规则 = 剩余不足阈值自动续满, 未不足则不动.
     *
     * @param snapshot         快照 (须含 userId 与 runtimeId)
     * @param thresholdSeconds 续约阈值 (秒), 剩余低于该值才续约
     * @param ttlSeconds       续满目标 (秒)
     * @param throttleSeconds  节流窗口 (秒), 距上次判断不足该值则跳过
     * @return 是否执行了续约 (节流跳过 / 未达阈值返回 false)
     */
    Mono<Boolean> renewIfLow(RuntimeSnapshot snapshot, long thresholdSeconds, long ttlSeconds, long throttleSeconds);
}