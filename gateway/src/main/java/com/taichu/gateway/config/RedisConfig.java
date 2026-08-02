package com.taichu.gateway.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.taichu.gateway.model.RuntimeSnapshot;
import com.taichu.gateway.repository.RuntimeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.ReactiveRedisConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.serializer.Jackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Optional;

/**
 * Redis 运行时仓储配置, 按 设计文档.md 第三章「gateway（gateway）」> Redis 双索引.
 *
 * 设计文档第三章: Redis 双索引存储运行时状态, 支持 userId、runtimeId 双向检索, 自带 TTL 过期机制.
 *
 * 键约定 (keyPrefix 默认 taichu-runtime):
 *   {prefix}:user:{userId}     -> RuntimeSnapshot JSON (按 userId 检索)
 *   {prefix}:runtime:{runtimeId} -> RuntimeSnapshot JSON (按 runtimeId 检索)
 *   {prefix}:user-index:{userId} -> runtimeId (反向索引, TTL 与快照同步)
 *   {prefix}:runtime-index:{runtimeId} -> userId (反向索引, TTL 与快照同步)
 */
@Slf4j
@Configuration
@RequiredArgsConstructor
public class RedisConfig {

    private final PlatformProperties gatewayProperties;

    @Bean
    public ReactiveRedisTemplate<String, RuntimeSnapshot> runtimeRedisTemplate(ReactiveRedisConnectionFactory factory) {
        ObjectMapper mapper = new ObjectMapper();
        mapper.registerModule(new JavaTimeModule());
        mapper.disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
        Jackson2JsonRedisSerializer<RuntimeSnapshot> valueSerializer = new Jackson2JsonRedisSerializer<>(mapper, RuntimeSnapshot.class);
        StringRedisSerializer keySerializer = new StringRedisSerializer();

        RedisSerializationContext<String, RuntimeSnapshot> context = RedisSerializationContext
                .<String, RuntimeSnapshot>newSerializationContext(keySerializer)
                .value(valueSerializer)
                .build();

        return new ReactiveRedisTemplate<>(factory, context);
    }

    @Bean
    public RuntimeRepository runtimeRepository(ReactiveRedisTemplate<String, RuntimeSnapshot> template,
                                               PlatformProperties properties) {
        return new RedisRuntimeRepositoryImpl(template, properties);
    }

    /**
     * Redis 实现 (内部类, 保持配置与实现紧邻).
     */
    @RequiredArgsConstructor
    private static class RedisRuntimeRepositoryImpl implements RuntimeRepository {

        /**
         * 增量续约脚本 (原子): KEYS[1]=user key, KEYS[2]=runtime key, KEYS[3]=节流 key.
         * 节流窗口内 (节流 key 存在) 直接返回 0, 不做判断;
         * 否则剩余 TTL > 0 且 < 阈值(ms) 时双 key 一并续满 ttl(ms), 返回 1;
         * 未达阈值仅记录判断时间 (写节流 key), 返回 2.
         * 节流状态存 Redis (PX 节流窗口后自动消失), 多副本共享同一节流语义.
         * 已过期 (PTTL=-2) 不续, 交给回收链路.
         */
        private static final String RENEW_IF_LOW_LUA =
                "if redis.call('EXISTS', KEYS[3]) == 1 then " +
                "  return 0 " +
                "end " +
                "local ttl = redis.call('PTTL', KEYS[1]) " +
                "if ttl > 0 and ttl < tonumber(ARGV[1]) then " +
                "  redis.call('PEXPIRE', KEYS[1], ARGV[2]) " +
                "  redis.call('PEXPIRE', KEYS[2], ARGV[2]) " +
                "  redis.call('SET', KEYS[3], 1, 'PX', ARGV[3]) " +
                "  return 1 " +
                "end " +
                "redis.call('SET', KEYS[3], 1, 'PX', ARGV[3]) " +
                "return 2";

        private final ReactiveRedisTemplate<String, RuntimeSnapshot> template;
        private final PlatformProperties properties;

        private final DefaultRedisScript<Long> renewIfLowScript =
                new DefaultRedisScript<>(RENEW_IF_LOW_LUA, Long.class);

        private String throttleKey(String runtimeId) {
            return properties.getRedis().getKeyPrefix() + ":renew-throttle:" + runtimeId;
        }

        private String userKey(String userId) {
            return properties.getRedis().getKeyPrefix() + ":user:" + userId;
        }

        private String runtimeKey(String runtimeId) {
            return properties.getRedis().getKeyPrefix() + ":runtime:" + runtimeId;
        }

        @Override
        public Mono<Optional<RuntimeSnapshot>> findByUserId(String userId) {
            return template.opsForValue().get(userKey(userId))
                    .map(Optional::of)
                    .defaultIfEmpty(Optional.empty());
        }

        @Override
        public Mono<Optional<RuntimeSnapshot>> findByRuntimeId(String runtimeId) {
            return template.opsForValue().get(runtimeKey(runtimeId))
                    .map(Optional::of)
                    .defaultIfEmpty(Optional.empty());
        }

        @Override
        public Mono<RuntimeSnapshot> save(RuntimeSnapshot snapshot, long ttlSeconds) {
            Duration ttl = Duration.ofSeconds(ttlSeconds);
            return Mono.zip(
                            template.opsForValue().set(userKey(snapshot.getUserId()), snapshot, ttl),
                            template.opsForValue().set(runtimeKey(snapshot.getRuntimeId()), snapshot, ttl)
                    )
                    .map(t -> snapshot);
        }

        @Override
        public Mono<Boolean> delete(String runtimeId) {
            return findByRuntimeId(runtimeId)
                    .flatMap(opt -> {
                        if (opt.isEmpty()) {
                            return Mono.just(false);
                        }
                        RuntimeSnapshot snapshot = opt.get();
                        return Mono.zip(
                                        template.opsForValue().delete(userKey(snapshot.getUserId())),
                                        template.opsForValue().delete(runtimeKey(runtimeId))
                                )
                                .map(t -> true);
                    })
                    .defaultIfEmpty(false);
        }

        @Override
        public Mono<Boolean> renewIfLow(RuntimeSnapshot snapshot, long thresholdSeconds, long ttlSeconds, long throttleSeconds) {
            return template.execute(renewIfLowScript,
                            java.util.List.of(userKey(snapshot.getUserId()), runtimeKey(snapshot.getRuntimeId()),
                                    throttleKey(snapshot.getRuntimeId())),
                            java.util.List.of(thresholdSeconds * 1000L, ttlSeconds * 1000L, throttleSeconds * 1000L))
                    .map(v -> v != null && v == 1)
                    .next()
                    .defaultIfEmpty(false);
        }
    }
}