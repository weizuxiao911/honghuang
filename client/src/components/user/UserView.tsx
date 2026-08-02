import React, { useState, useEffect, useRef } from 'react';

/**
 * userPage 槽位默认 view — client 内置用户信息卡片 (右上角浮动弹窗)
 *
 * 作为 OpenSumi userPage slot 的默认注册 view (id='user-default'),
 * LayoutComponent 用 <SlotRenderer slot="userPage"> 渲染本组件。
 *
 * 渲染行为:
 *   - visible=false → 不渲染内容 (用 display:none, 不反复 mount/unmount 丢状态)
 *   - visible=true → 渲染 fixed top-right 浮动弹窗, 内含:
 *     - 头部: 头像 + 用户名 + Free 标识 + "升级会员" 按钮
 *     - 菜单列表: 管理账号 / 消息 (带徽标) / 主题 (子菜单) / 检查更新 / 帮助文档 / 联系我们 / 报告问题
 *     - 底部: "退出登录" 按钮 (调 clearSession)
 *
 * 显隐控制:
 *   - 'taichu:user-show'  → visible=true
 *   - 'taichu:user-hide'  → visible=false
 *   - 点击弹窗外 (popover 外) → 自动关闭
 *   - 按 Esc 键 → 关闭
 *
 * 自定义 VSIX 替换 (铁律 12):
 *   - VS Code 标准: contributes.views + contributes.viewsContainers 注册
 *     view container (type='userPage', 由 client 框架按 VS Code 标准暴露)
 *   - 旧路径 (向后兼容): window event 'taichu:user-custom-view' 或
 *     window.__TAICHU_USER_API__.setCustomView(component) 接管本 view
 */

export const UserView: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);
  const [customView, setCustomView] = useState<React.ComponentType<any> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // 读取登录 session 用于显示用户名
  const readSessionFromStorage = () => {
    try {
      const raw = localStorage.getItem('taichu.login.session');
      if (raw) return JSON.parse(raw);
    } catch {
      /* ignore */
    }
    const cfg = (window as any).__TAICHU_DEPLOY_CONFIG__;
    return cfg?.userId ? { username: cfg.username, userId: cfg.userId } : null;
  };
  const [session, setSession] = useState(() => readSessionFromStorage());

  // 显隐事件 + 自定义 view + session 事件
  useEffect(() => {
    const showHandler = () => setVisible(true);
    const hideHandler = () => setVisible(false);
    const sessionHandler = () => setSession(readSessionFromStorage());
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.component) {
        setCustomView(() => detail.component);
      }
    };
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    const outsideClickHandler = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      const target = e.target as Node;
      // 点击 popover 内部不关, 其它区域都关 (含 TopBar 账号按钮自身:
      // 账号按钮再次点击由它自己的 handler 控制 toggle, 不在这里关)
      if (popoverRef.current.contains(target)) return;
      // 但要排除账号按钮自身 (账号按钮 toggle 不算 outside click)
      const accountBtn = document.querySelector('.tc-topbar__account-btn');
      if (accountBtn && accountBtn.contains(target)) return;
      setVisible(false);
    };

    window.addEventListener('taichu:user-show', showHandler);
    window.addEventListener('taichu:user-hide', hideHandler);
    window.addEventListener('taichu:login-session-changed', sessionHandler);
    window.addEventListener('taichu:user-custom-view', customHandler);
    document.addEventListener('keydown', escHandler);
    if (visible) {
      // outside click 只在 visible 时监听 (避免初始挂载时误关)
      setTimeout(() => document.addEventListener('mousedown', outsideClickHandler), 0);
    }

    return () => {
      window.removeEventListener('taichu:user-show', showHandler);
      window.removeEventListener('taichu:user-hide', hideHandler);
      window.removeEventListener('taichu:login-session-changed', sessionHandler);
      window.removeEventListener('taichu:user-custom-view', customHandler);
      document.removeEventListener('keydown', escHandler);
      document.removeEventListener('mousedown', outsideClickHandler);
    };
  }, [visible]);

  // 暴露 user API
  useEffect(() => {
    (window as any).__TAICHU_USER_API__ = {
      ...((window as any).__TAICHU_USER_API__ || {}),
      setCustomView: (component: React.ComponentType<any>) => {
        setCustomView(() => component);
      },
      resetCustomView: () => setCustomView(null),
    };
  }, []);

  const handleLogout = () => {
    // 客户端轻量退出: 只清本地 session + 派发 session-changed 事件,
    // 不跳 server.ts logout 端点 (避免 404 页面跳转, UI 直接切回登录按钮)
    try {
      localStorage.removeItem('taichu.login.session');
    } catch {
      /* ignore */
    }
    delete (window as any).__TAICHU_LOGIN_SESSION__;
    window.dispatchEvent(
      new CustomEvent('taichu:login-session-changed', { detail: null })
    );
    setVisible(false);
  };

  // 自定义 VSIX 接管 → 渲染自定义组件 (绕过默认用户卡片)
  if (customView) {
    const CustomComponent = customView;
    return (
      <div
        ref={popoverRef}
        style={{
          position: 'fixed',
          top: 44,
          right: 12,
          zIndex: 9998,
          display: visible ? 'block' : 'none',
        }}
      >
        <CustomComponent />
      </div>
    );
  }

  const username = (session as any)?.username || (session as any)?.userId || '未登录';
  const initial = (username || 'U').charAt(0).toUpperCase();

  return (
    <div
      ref={popoverRef}
      className="tc-user-popover"
      style={{
        // fixed top-right 浮动弹窗 (TopBar 下方, 距离右边界 12px)
        position: 'fixed',
        top: 44,
        right: 12,
        zIndex: 9998,
        display: visible ? 'block' : 'none',
      }}
    >
      <style>{`
        .tc-user-popover {
          width: 320px;
          background: #1c1c22;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          box-shadow: 0 12px 48px rgba(0, 0, 0, 0.6), 0 2px 8px rgba(0, 0, 0, 0.4);
          color: #e5e7eb;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          overflow: hidden;
          animation: tc-user-popover-in 0.16s ease-out;
        }
        @keyframes tc-user-popover-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .tc-user-popover__header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
        }
        .tc-user-popover__avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: #fff;
          flex-shrink: 0;
        }
        .tc-user-popover__name {
          font-size: 14px;
          font-weight: 600;
          color: #f9fafb;
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .tc-user-popover__plan {
          display: inline-block;
          font-size: 10px;
          padding: 1px 6px;
          margin-left: 6px;
          border-radius: 4px;
          background: rgba(148, 163, 184, 0.18);
          color: #94a3b8;
          font-weight: 500;
          vertical-align: middle;
        }
        .tc-user-popover__upgrade {
          width: calc(100% - 32px);
          margin: 0 16px 12px;
          height: 36px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.05s;
        }
        .tc-user-popover__upgrade:hover { opacity: 0.9; }
        .tc-user-popover__upgrade:active { transform: scale(0.98); }

        .tc-user-popover__divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.06);
          margin: 0;
        }

        .tc-user-popover__menu {
          list-style: none;
          margin: 0;
          padding: 6px 0;
        }
        .tc-user-popover__menu li {
          display: flex;
          align-items: center;
          height: 36px;
          padding: 0 16px;
          cursor: pointer;
          font-size: 13px;
          color: #cbd5e1;
          transition: background 0.12s, color 0.12s;
        }
        .tc-user-popover__menu li:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #f9fafb;
        }
        .tc-user-popover__menu-icon {
          width: 18px;
          height: 18px;
          margin-right: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
          flex-shrink: 0;
        }
        .tc-user-popover__menu-text {
          flex: 1;
        }
        .tc-user-popover__menu-suffix {
          font-size: 11px;
          color: #64748b;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .tc-user-popover__menu-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 9px;
          background: #10b981;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
        }

        .tc-user-popover__logout {
          width: calc(100% - 32px);
          margin: 8px 16px 16px;
          height: 36px;
          background: transparent;
          color: #cbd5e1;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.12s, color 0.12s, border-color 0.12s;
        }
        .tc-user-popover__logout:hover {
          background: rgba(239, 68, 68, 0.12);
          color: #fecaca;
          border-color: rgba(239, 68, 68, 0.35);
        }
      `}</style>

      <div className="tc-user-popover__header">
        <span className="tc-user-popover__avatar">{initial}</span>
        <h3 className="tc-user-popover__name">
          {username}
          <span className="tc-user-popover__plan">Free</span>
        </h3>
      </div>

      <button className="tc-user-popover__upgrade">升级会员</button>

      <div className="tc-user-popover__divider" />

      <ul className="tc-user-popover__menu">
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 7h18M3 12h18M3 17h12" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">管理账号</span>
          <span className="tc-user-popover__menu-suffix">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">消息</span>
          <span className="tc-user-popover__menu-suffix">
            <span className="tc-user-popover__menu-badge">2</span>
          </span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 3v18M3 12h18" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">主题</span>
          <span className="tc-user-popover__menu-suffix">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 12a9 9 0 1 1-9-9M21 3v6h-6" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">检查更新</span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">帮助文档</span>
          <span className="tc-user-popover__menu-suffix">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">联系我们</span>
          <span className="tc-user-popover__menu-suffix">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </span>
        </li>
        <li>
          <span className="tc-user-popover__menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10.3 3.86l-7.4 12.86A2 2 0 0 0 4.66 20h14.68a2 2 0 0 0 1.76-3.28l-7.4-12.86a2 2 0 0 0-3.4 0z" />
            </svg>
          </span>
          <span className="tc-user-popover__menu-text">报告问题</span>
        </li>
      </ul>

      <button className="tc-user-popover__logout" onClick={handleLogout}>
        退出登录
      </button>
    </div>
  );
};