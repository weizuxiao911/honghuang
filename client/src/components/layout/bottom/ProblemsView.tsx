import React, { useState } from 'react';

/**
 * 简易 "问题" 面板 — 模拟 VS Code 的 PROBLEMS 区
 *
 * 展示一些 mock 错误/警告条目, 让 layoutConfig[bottom] 有真实业务内容,
 * 触发 OpenSumi TabbarService 真实渲染 bottom panel.
 *
 * 后续可被真实 VS Code 风格的问题面板 VSIX 替换.
 */
export const ProblemsView: React.FC = () => {
  const [problems] = useState([
    {
      file: 'src/components/login/LoginView.tsx',
      line: 42,
      column: 7,
      severity: 'error',
      message: 'Type "string | undefined" is not assignable to type "string"',
      source: 'tsc',
    },
    {
      file: 'src/components/layout/layout.tsx',
      line: 67,
      column: 12,
      severity: 'warning',
      message: 'React Hook useEffect has missing dependency: "layoutService"',
      source: 'eslint',
    },
    {
      file: 'src/config/slots.ts',
      line: 8,
      column: 3,
      severity: 'info',
      message: 'Module "@opensumi/ide-editor" has been deprecated, use "@opensumi/ide-monaco-editor" instead',
      source: 'sumi',
    },
  ]);

  const severityColor: Record<string, string> = {
    error: '#ef4444',
    warning: '#eab308',
    info: '#3b82f6',
  };

  const severityIcon: Record<string, string> = {
    error: '⊗',
    warning: '△',
    info: 'ⓘ',
  };

  return (
    <div
      style={{
        height: '100%',
        background: '#0e0e12',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '32px',
          flexShrink: 0,
          padding: '0 12px',
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          color: '#9ca3af',
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ flex: 1 }}>问题</span>
        <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'none' }}>
          {problems.length} 条
        </span>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {problems.map((p, i) => (
          <div
            key={i}
            style={{
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span
              style={{
                color: severityColor[p.severity],
                fontSize: '14px',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              {severityIcon[p.severity]}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: '#e5e7eb',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.message}
              </div>
              <div
                style={{
                  color: '#6b7280',
                  fontSize: '11px',
                  marginTop: '2px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                [{p.source}] {p.file}:{p.line}:{p.column}
              </div>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
