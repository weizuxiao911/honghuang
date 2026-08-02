import React, { useState, useEffect } from 'react';

/**
 * SandboxLoading — 沙箱启动全屏 loading overlay
 *
 * 触发事件:
 *   - 'taichu:fs-loading' → 显示 overlay (phase 信息可读)
 *   - 'taichu:fs-ready'   → 关闭 overlay
 *   - 'taichu:fs-error'   → 显示 overlay (错误态, 提供"重试"/"登出"操作)
 *   - 'taichu:fs-teardown'→ 关闭 overlay
 *
 * UI: 半透明 backdrop (rgba 黑 0.5) + 居中卡片 (深色 enterprise 调性),
 *   紫蓝色 spinner (CSS animation) + "加载 sandbox 中, 预计需等待 3~10s" 提示
 * + 错误态: 红色感叹号 + 错误信息 + 重试/登出 按钮
 *
 * 不打断 IDE 骨架 — login overlay 已关闭后, 用户能看到 IDE 在背后,
 * 仅中央 loading 卡片挡住 main 编辑区, 不挡 left/right/bottom panel.
 */

type Phase =
  | 'idle'
  | 'fetching-runtime'
  | 'error';

export const SandboxLoading: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [runtimeId, setRuntimeId] = useState<string | null>(null);

  useEffect(() => {
    const onLoading = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setPhase(detail.phase || 'fetching-runtime');
      setError(null);
    };
    const onReady = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setRuntimeId(detail.runtimeId || null);
      setPhase('idle');
      setError(null);
    };
    const onError = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setError(
        detail instanceof Error
          ? detail
          : new Error(typeof detail === 'string' ? detail : 'sandbox 启动失败')
      );
      setPhase('error');
    };
    const onTeardown = () => {
      setPhase('idle');
      setError(null);
      setRuntimeId(null);
    };

    window.addEventListener('taichu:fs-loading', onLoading);
    window.addEventListener('taichu:fs-ready', onReady);
    window.addEventListener('taichu:fs-error', onError);
    window.addEventListener('taichu:fs-teardown', onTeardown);

    return () => {
      window.removeEventListener('taichu:fs-loading', onLoading);
      window.removeEventListener('taichu:fs-ready', onReady);
      window.removeEventListener('taichu:fs-error', onError);
      window.removeEventListener('taichu:fs-teardown', onTeardown);
    };
  }, []);

  if (phase === 'idle') return null;

  const retry = () => {
    const sess = (window as any).__TAICHU_DEPLOY_CONFIG__?.userId
      ? null
      : (() => {
          try {
            const raw = localStorage.getItem('taichu.login.session');
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        })();
    if (sess?.userId) {
      window.dispatchEvent(new CustomEvent('taichu:login-session-changed', { detail: sess }));
    } else {
      // 没 session 退回 login
      window.dispatchEvent(new CustomEvent('taichu:login-show'));
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem('taichu.login.session');
    } catch {
      /* ignore */
    }
    delete (window as any).__TAICHU_LOGIN_SESSION__;
    delete (window as any).__TAICHU_RUNTIME__;
    window.dispatchEvent(
      new CustomEvent('taichu:login-session-changed', { detail: null })
    );
    window.dispatchEvent(new CustomEvent('taichu:login-show'));
  };

  return (
    <div className="tc-sandbox-loading">
      <style>{`
        .tc-sandbox-loading {
          position: fixed;
          inset: 0;
          z-index: 9000;
          background: rgba(10, 10, 11, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: tc-sandbox-loading-in 0.2s ease-out;
        }
        @keyframes tc-sandbox-loading-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .tc-sandbox-loading__card {
          min-width: 360px;
          max-width: 480px;
          padding: 32px 36px;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.96), rgba(15, 23, 42, 0.96));
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6), 0 0 1px rgba(99, 102, 241, 0.3);
          color: #e5e7eb;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          text-align: center;
          user-select: none;
        }
        .tc-sandbox-loading__spinner {
          width: 56px;
          height: 56px;
          margin: 0 auto 20px;
          position: relative;
        }
        .tc-sandbox-loading__spinner-ring {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          border: 3px solid rgba(99, 102, 241, 0.18);
          border-top-color: #6366f1;
          animation: tc-sandbox-loading-spin 1s linear infinite;
        }
        .tc-sandbox-loading__spinner-ring:nth-child(2) {
          inset: 6px;
          border-top-color: #8b5cf6;
          animation-duration: 1.4s;
          animation-direction: reverse;
        }
        @keyframes tc-sandbox-loading-spin {
          to { transform: rotate(360deg); }
        }
        .tc-sandbox-loading__title {
          font-size: 16px;
          font-weight: 600;
          color: #f9fafb;
          margin: 0 0 8px;
          letter-spacing: 0.01em;
        }
        .tc-sandbox-loading__hint {
          font-size: 12px;
          color: #94a3b8;
          margin: 0;
          line-height: 1.6;
        }
        .tc-sandbox-loading__hint code {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          padding: 1px 6px;
          background: rgba(99, 102, 241, 0.18);
          color: #c7d2fe;
          border-radius: 4px;
        }
        .tc-sandbox-loading__progress {
          margin-top: 18px;
          height: 4px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 2px;
          overflow: hidden;
          position: relative;
        }
        .tc-sandbox-loading__progress::after {
          content: '';
          position: absolute;
          top: 0;
          left: -40%;
          width: 40%;
          height: 100%;
          background: linear-gradient(90deg, transparent, #6366f1, transparent);
          animation: tc-sandbox-loading-progress 1.6s ease-in-out infinite;
        }
        @keyframes tc-sandbox-loading-progress {
          from { left: -40%; }
          to { left: 100%; }
        }
        .tc-sandbox-loading__error {
          width: 56px;
          height: 56px;
          margin: 0 auto 16px;
          border-radius: 50%;
          background: rgba(239, 68, 68, 0.18);
          color: #fca5a5;
          font-size: 28px;
          font-weight: 700;
          line-height: 56px;
        }
        .tc-sandbox-loading__error-title {
          font-size: 15px;
          font-weight: 600;
          color: #fecaca;
          margin: 0 0 6px;
        }
        .tc-sandbox-loading__error-msg {
          font-size: 12px;
          color: #fca5a5;
          margin: 0 0 18px;
          word-break: break-all;
          line-height: 1.5;
          max-height: 80px;
          overflow: auto;
        }
        .tc-sandbox-loading__actions {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .tc-sandbox-loading__btn {
          padding: 7px 18px;
          font-size: 13px;
          font-weight: 500;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.04);
          color: #cbd5e1;
          cursor: pointer;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .tc-sandbox-loading__btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f9fafb;
        }
        .tc-sandbox-loading__btn--primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-color: transparent;
          color: #fff;
        }
        .tc-sandbox-loading__btn--primary:hover {
          filter: brightness(1.05);
          color: #fff;
        }
      `}</style>

      <div className="tc-sandbox-loading__card">
        {phase === 'error' ? (
          <>
            <div className="tc-sandbox-loading__error">!</div>
            <h3 className="tc-sandbox-loading__error-title">沙箱启动失败</h3>
            <p className="tc-sandbox-loading__error-msg">
              {error?.message || '未知错误'}
            </p>
            <div className="tc-sandbox-loading__actions">
              <button
                className="tc-sandbox-loading__btn"
                onClick={logout}
              >
                退出登录
              </button>
              <button
                className="tc-sandbox-loading__btn tc-sandbox-loading__btn--primary"
                onClick={retry}
              >
                重试
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="tc-sandbox-loading__spinner">
              <div className="tc-sandbox-loading__spinner-ring" />
              <div className="tc-sandbox-loading__spinner-ring" />
            </div>
            <h3 className="tc-sandbox-loading__title">加载 sandbox 中</h3>
            <p className="tc-sandbox-loading__hint">
              预计需等待 <code>3 ~ 10s</code>
            </p>
            <div className="tc-sandbox-loading__progress" />
            <p className="tc-sandbox-loading__hint" style={{ marginTop: 12, fontSize: 11 }}>
              {runtimeId
                ? `runtime: ${runtimeId}`
                : '正在初始化沙箱 runtime (K8s Pod + sandbox 探活) ...'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};