import React, { useState, useEffect } from 'react';

/**
 * Taichu TopBar — 框架级顶部 chrome
 *
 * 布局 (flex layout, space-between):
 *   - left: "T" logo + "太初 (Taichu) brand"
 *   - right: 3 个 layout 按钮 (左侧栏 / 右侧栏 / 底部栏) + 登录入口
 *
 * 3 个 layout 按钮 (Trae 风格):
 *   - 折叠状态: 对应 layout 位置空心 icon
 *   - 展开状态: 对应 layout 位置填充 icon
 *   - 点击 → dispatch 'taichu:layout-{left|right|bottom}-toggle' 事件
 *   - LayoutComponent 监听, 切换对应 slot 显隐
 *
 * 登录入口:
 *   - 未登录: 纯文字 "登录" 按钮 (紫色文字颜色), 点击 → 'taichu:login-show'
 *   - 已登录: 圆形头像 (用户名首字母), 点击 → 'taichu:login-show' (切换账号)
 */

interface LoginSession {
  username?: string;
  userId?: string;
  avatarUrl?: string;
}

function readLoginSession(): LoginSession | null {
  const cfg = (window as any).__TAICHU_DEPLOY_CONFIG__;
  if (cfg?.userId) {
    return {
      username: cfg.username || cfg.userId,
      userId: cfg.userId,
      avatarUrl: cfg.avatarUrl || '',
    };
  }
  try {
    const raw = localStorage.getItem('taichu.login.session');
    if (raw) {
      const s = JSON.parse(raw);
      if (s && s.userId) return s;
    }
  } catch {
    /* ignore */
  }
  return null;
}

const LeftIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    {filled ? (
      <rect x="3" y="4" width="6" height="16" fill="currentColor" stroke="none" />
    ) : (
      <line x1="9" y1="4" x2="9" y2="20" />
    )}
  </svg>
);

const RightIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    {filled ? (
      <rect x="15" y="4" width="6" height="16" fill="currentColor" stroke="none" />
    ) : (
      <line x1="15" y1="4" x2="15" y2="20" />
    )}
  </svg>
);

const BottomIcon = ({ filled }: { filled: boolean }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    {filled ? (
      <rect x="3" y="16" width="18" height="4" fill="currentColor" stroke="none" />
    ) : (
      <line x1="3" y1="16" x2="21" y2="16" />
    )}
  </svg>
);

export const TopBar: React.FC = () => {
  const [leftVisible, setLeftVisible] = useState<boolean>(true);
  const [rightVisible, setRightVisible] = useState<boolean>(true);
  const [bottomVisible, setBottomVisible] = useState<boolean>(true);
  const [session, setSession] = useState<LoginSession | null>(null);

  // 监听三个 layout slot 的状态变化 (来自 LayoutComponent 或其它 source)
  useEffect(() => {
    const handlers = {
      'taichu:layout-left-changed': (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail && typeof detail.visible === 'boolean') setLeftVisible(detail.visible);
      },
      'taichu:layout-right-changed': (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail && typeof detail.visible === 'boolean') setRightVisible(detail.visible);
      },
      'taichu:layout-bottom-changed': (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail && typeof detail.visible === 'boolean') setBottomVisible(detail.visible);
      },
    };
    Object.entries(handlers).forEach(([event, handler]) => {
      window.addEventListener(event, handler);
    });
    return () => {
      Object.entries(handlers).forEach(([event, handler]) => {
        window.removeEventListener(event, handler);
      });
    };
  }, []);

  // 监听登录状态变化
  useEffect(() => {
    const update = () => setSession(readLoginSession());
    update();
    window.addEventListener('taichu:login-session-changed', update);
    return () => window.removeEventListener('taichu:login-session-changed', update);
  }, []);

  const toggleLeft = () => {
    window.dispatchEvent(new CustomEvent('taichu:layout-left-toggle'));
  };
  const toggleRight = () => {
    window.dispatchEvent(new CustomEvent('taichu:layout-right-toggle'));
  };
  const toggleBottom = () => {
    window.dispatchEvent(new CustomEvent('taichu:layout-bottom-toggle'));
  };

  const showLogin = () => {
    window.dispatchEvent(new CustomEvent('taichu:login-show'));
  };

  return (
    <div className="tc-topbar">
      <style>{`
        .tc-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 36px;
          padding: 0 12px;
          background: transparent;
          color: var(--foreground, #e5e7eb);
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          flex-shrink: 0;
        }
        .tc-topbar__left {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tc-topbar__logo {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          color: #fff;
          line-height: 1;
        }
        .tc-topbar__brand {
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground, #e5e7eb);
          letter-spacing: 0.01em;
        }
        .tc-topbar__right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .tc-topbar__divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.25);
          margin: 0 8px;
        }
        /* 3 个 layout toggle 按钮 - 纯 icon, 无外壳 */
        .tc-topbar__btn {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--descriptionForeground, #8b929b);
          cursor: pointer;
          padding: 0;
          border-radius: 0;
          transition: color 0.15s;
        }
        .tc-topbar__btn:hover {
          color: var(--foreground, #e5e7eb);
        }
        .tc-topbar__btn.is-active {
          color: #c7d2fe;
        }
        .tc-topbar__btn:focus-visible {
          outline: none;
          color: #c7d2fe;
        }
        .tc-topbar__btn:active {
          transform: scale(0.9);
        }
        .tc-topbar__btn svg {
          width: 16px;
          height: 16px;
        }
        /* 登录 按钮 - 纯文字 + 紫色文字颜色, 宽度 56px */
        .tc-topbar__login {
          width: 56px;
          height: 24px;
          padding: 0 10px;
          color: #a5b4fc;
          font-size: 12px;
          font-weight: 500;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .tc-topbar__login:hover {
          color: #c7d2fe;
          background: rgba(99, 102, 241, 0.12);
        }
        /* 用户头像 - 圆形 logo */
        .tc-topbar__avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: #fff;
          line-height: 1;
        }
      `}</style>
      <div className="tc-topbar__left">
        <span className="tc-topbar__logo">T</span>
        <span className="tc-topbar__brand">太初 (Taichu)</span>
      </div>
      <div className="tc-topbar__right">
        <button
          className={`tc-topbar__btn ${leftVisible ? 'is-active' : ''}`}
          title={leftVisible ? '折叠左侧栏' : '展开左侧栏'}
          onClick={toggleLeft}
        >
          <LeftIcon filled={leftVisible} />
        </button>
        <button
          className={`tc-topbar__btn ${bottomVisible ? 'is-active' : ''}`}
          title={bottomVisible ? '折叠底部栏' : '展开底部栏'}
          onClick={toggleBottom}
        >
          <BottomIcon filled={bottomVisible} />
        </button>
        <button
          className={`tc-topbar__btn ${rightVisible ? 'is-active' : ''}`}
          title={rightVisible ? '折叠右侧栏' : '展开右侧栏'}
          onClick={toggleRight}
        >
          <RightIcon filled={rightVisible} />
        </button>
        <div className="tc-topbar__divider" />

        {session ? (
          <button
            className="tc-topbar__btn"
            title={`${session.username || session.userId} (点击切换账号)`}
            onClick={showLogin}
          >
            <span className="tc-topbar__avatar">
              {(session.username || session.userId || 'U').charAt(0).toUpperCase()}
            </span>
          </button>
        ) : (
          <button
            className="tc-topbar__btn tc-topbar__login"
            title="登录"
            onClick={showLogin}
          >
            登录
          </button>
        )}
      </div>
    </div>
  );
};
