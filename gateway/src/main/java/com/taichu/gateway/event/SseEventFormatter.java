package com.taichu.gateway.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * SSE 协议格式化工具.
 *
 * yunyan-agent SseEventFormatter 字段对照.
 * Spring WebFlux MediaType.TEXT_EVENT_STREAM_VALUE 标准格式:
 *   event: <type>\n
 *   id: <eventId>\n
 *   data: <json>\n\n
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SseEventFormatter {

    private final ObjectMapper objectMapper;

    /**
     * 判断事件是否属于指定用户.
     */
    public boolean isForUser(String message, String userId) {
        try {
            Map<String, Object> map = objectMapper.readValue(message, Map.class);
            return userId.equals(map.get("userId"));
        } catch (Exception e) {
            log.warn("解析 SSE 事件失败", e);
            return false;
        }
    }

    /**
     * 将 JSON 消息格式化为 SSE 协议字符串.
     */
    public String toSseFormat(String message) {
        try {
            Map<String, Object> map = objectMapper.readValue(message, Map.class);
            String eventType = (String) map.getOrDefault("type", "UNKNOWN");
            String eventId = (String) map.getOrDefault("id", "");

            StringBuilder sb = new StringBuilder();
            sb.append("event: ").append(eventType).append("\n");
            if (!eventId.isEmpty()) {
                sb.append("id: ").append(eventId).append("\n");
            }
            sb.append("data: ").append(message).append("\n\n");
            return sb.toString();
        } catch (Exception e) {
            log.warn("格式化 SSE 事件失败", e);
            return "";
        }
    }

    /**
     * 生成心跳 SSE comment.
     */
    public String heartbeat() {
        return ": heartbeat\n\n";
    }
}