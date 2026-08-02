import React from 'react';

/**
 * 右侧栏 AI 侧栏默认 view (VS Code 辅助栏 / Secondary Side Bar 对应)
 *
 * 骨架实现, 仅展示"AI 助手"标识和预留的"新会话/历史会话"按钮区;
 * 后续接入 @opencode-ai/sdk (全局) 后, 这里渲染会话列表 / 消息流 / 输入框 / 上传等.
 *
 * 业务 VSIX 可通过 contributes.views + viewsContainers 注册自定义 view 覆盖默认.
 */
export const AiPanelView: React.FC = () => {
  return (
    <div
      style={{
        height: '100%',
        background: '#0e0e12',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '13px',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        userSelect: 'none',
      }}
    >
      {/* 头部 */}
      <div
        style={{
          height: '36px',
          flexShrink: 0,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '6px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          A
        </div>
        <div style={{ flex: 1, fontWeight: 600 }}>AI 助手</div>
        <button
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '4px 8px',
            borderRadius: '4px',
          }}
        >
          +
        </button>
      </div>

      {/* 中间内容 (骨架占位) */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
          fontSize: '12px',
          flexDirection: 'column',
          gap: '12px',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '32px', opacity: 0.4 }}>🤖</div>
        <div>ai-panel 骨架</div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          接入 @opencode-ai/sdk 后, 这里渲染会话/消息/上传
        </div>
        <div style={{ fontSize: '11px', opacity: 0.7 }}>
          VSIX 可注册 view container 覆盖默认
        </div>
      </div>

      {/* 底部输入区 (骨架占位) */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div
          style={{
            height: '40px',
            background: '#1a1a1f',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            color: '#6b7280',
            fontSize: '12px',
          }}
        >
          消息输入区 (待接入)
        </div>
      </div>
    </div>
  );
};
