package com.taichu.gateway.model;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

/**
 * SSE 平台事件模型 - 状态变更广播.
 *
 * yunyan-agent SseEvent 字段对照. Spring Cloud Gateway 反应式 SSE 响应.
 */
@Value
@Builder(toBuilder = true)
public class SseEvent {

    /** 事件 ID (UUID 短码, 用于 SSE Last-Event-ID 续传). */
    String id;

    /** 事件类型 (见 RuntimeEventType). */
    String type;

    /** 目标用户 ID (按 userId 过滤). */
    String userId;

    /** 关联 runtime ID. */
    String runtimeId;

    /** 运行时状态 (Status.name()). */
    String status;

    /** 事件描述. */
    String message;

    /** 时间戳. */
    Instant timestamp;

    /**
     * 从 runtime snapshot 构造事件.
     */
    public static SseEventBuilder fromSnapshot(RuntimeSnapshot snapshot) {
        return SseEvent.builder()
                .userId(snapshot.getUserId())
                .runtimeId(snapshot.getRuntimeId())
                .status(snapshot.getStatus());
    }
}