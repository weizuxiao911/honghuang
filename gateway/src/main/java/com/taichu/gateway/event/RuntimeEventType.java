package com.taichu.gateway.event;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 平台运行时事件类型.
 *
 * yunyan-agent RuntimeEventType 字段对照.
 * 客户端按 type 字段路由处理.
 */
@Getter
@RequiredArgsConstructor
public enum RuntimeEventType {

    /** 收到创建请求, Redis 索引已建. */
    CREATED("runtime 已创建"),
    /** K8s Deployment 资源已下发, 等待 Pod Ready. */
    SCHEDULED("调度中"),
    /** sandbox 内部 /global/health 返 200, 业务可访问. */
    READY("已就绪"),
    /** 重启流程触发. */
    RESTARTED("重启中"),
    /** TTL 到期 / 主动删除, K8s 资源已释放. */
    RECYCLED("已回收"),
    /** 创建/重启失败. */
    FAILED("操作失败"),
    /** 续约成功. */
    RENEWED("租约已续约"),
    /** SSE 连接建立时立即推送, 含当前快照. */
    INITIAL_STATE("连接已建立");

    private final String defaultDescription;
}