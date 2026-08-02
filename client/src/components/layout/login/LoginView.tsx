import React, { useState, useEffect } from 'react';

import { readSession, writeSession, installLoginApi } from './api';

/**
 * login 槽位默认 view — client 内置默认登录交互 (用户名/密码 mock)
 *
 * 作为 OpenSumi login slot 的默认注册 view (id='login-default'),
 * LayoutComponent 用 <SlotRenderer slot="login"> 渲染本组件。
 *
 * 渲染行为:
 *   - visible=false (default) → 渲染 nothing (本组件不返回 null,
 *     而是用 visibility:hidden 占位, 避免 SlotRenderer 反复 mount/unmount
 *     引起的 children 状态丢失)
 *   - visible=true → 渲染 fixed full-screen overlay, 盖住 IDE 骨架
 *
 * 显隐控制:
 *   - 'taichu:login-show'  → visible=true
 *   - 'taichu:login-hide'  → visible=false
 *   - 'taichu:login-session-changed' → 已登录 → visible=false
 *   - 初次 mount 时若已登录 → visible=false
 *
 * 自定义 VSIX 替换 (铁律 12):
 *   - VS Code 标准: contributes.views + contributes.viewsContainers 注册
 *     view container (type='login', 由 client 框架按 VS Code 标准暴露)
 *   - 旧路径 (向后兼容): window event 'taichu:login-custom-view' 或
 *     window.__TAICHU_LOGIN_API__.setCustomView(component) 接管本 view
 */

export const LoginView: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(false);
  const [customView, setCustomView] = useState<React.ComponentType<any> | null>(null);
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [, setTick] = useState(0);

  // 显隐事件监听 + 自定义 view 事件 + session 事件
  useEffect(() => {
    const showHandler = () => setVisible(true);
    const hideHandler = () => setVisible(false);
    const sessionHandler = () => {
      setTick((t) => t + 1);
      // 已登录 → 关闭 overlay
      if (readSession()) {
        setVisible(false);
      }
    };
    const customHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.component) {
        setCustomView(() => detail.component);
      }
    };

    window.addEventListener('taichu:login-show', showHandler);
    window.addEventListener('taichu:login-hide', hideHandler);
    window.addEventListener('taichu:login-session-changed', sessionHandler);
    window.addEventListener('taichu:login-custom-view', customHandler);

    // 初次 mount: 若已登录, 保持 hidden
    if (readSession()) {
      setVisible(false);
    }

    return () => {
      window.removeEventListener('taichu:login-show', showHandler);
      window.removeEventListener('taichu:login-hide', hideHandler);
      window.removeEventListener('taichu:login-session-changed', sessionHandler);
      window.removeEventListener('taichu:login-custom-view', customHandler);
    };
  }, []);

  // 暴露登录状态读写 API (供 VSIX 直接调用) + setCustomView 接管入口
  useEffect(() => {
    installLoginApi();
    (window as any).__TAICHU_LOGIN_API__ = {
      ...((window as any).__TAICHU_LOGIN_API__ || {}),
      setCustomView: (component: React.ComponentType<any>) => {
        setCustomView(() => component);
      },
      resetCustomView: () => setCustomView(null),
    };
  }, []);

  // 自定义 VSIX 接管 → 直接渲染自定义组件 (跳过默认 login UI)
  if (customView) {
    const CustomComponent = customView;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: '#0a0a0b',
          display: visible ? 'block' : 'none',
        }}
      >
        <CustomComponent />
      </div>
    );
  }

  // 用户名/密码登录: 直接 mock 写入登录状态 (生产应接企业 SSO/OAuth)
  const handleUsernameLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const trimmedName = username.trim();
    if (!trimmedName) {
      setError('请输入用户名 / 用户 ID');
      return;
    }
    if (!password) {
      setError('请输入密码');
      return;
    }
    writeSession({
      username: trimmedName,
      userId: trimmedName,
      avatarUrl: '',
    });
  };

  return (
    <div
      className="tc-login-root"
      style={{
        // fixed 全屏 overlay, 盖住 IDE 骨架 (TopBar + 三个 panel + main)
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        // visible=false 时保留在 DOM 中避免 SlotRenderer 反复 mount/unmount
        // 但用户看不到; layout 状态完全保持 (表单输入不丢)
        display: visible ? 'flex' : 'none',
      }}
    >
      <style>{`
        .tc-login-root {
          width: 100vw;
          height: 100vh;
          background: #0a0a0b;
          color: #e5e7eb;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
          margin: 0;
          padding: 0;
          overflow: hidden;
        }

        /* 左侧品牌区 */
        .tc-login-brand {
          flex: 1.4;
          background:
            radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.3), transparent 55%),
            radial-gradient(ellipse at 70% 80%, rgba(139, 92, 246, 0.22), transparent 55%),
            linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: 48px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .tc-login-brand::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 32px 32px;
          pointer-events: none;
          mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
        }

        .tc-login-brand .tc-brand-tags {
          position: absolute;
          top: 32px;
          left: 32px;
          display: flex;
          gap: 8px;
          z-index: 2;
        }

        .tc-login-brand .tc-brand-tag {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: 500;
          color: #cbd5e1;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          backdrop-filter: blur(8px);
        }

        .tc-login-logo {
          width: 96px;
          height: 96px;
          border-radius: 24px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 32px;
          box-shadow: 0 20px 60px rgba(99, 102, 241, 0.4);
          position: relative;
          z-index: 1;
        }

        .tc-login-brand h1 {
          font-size: 40px;
          margin: 0 0 12px 0;
          font-weight: 700;
          letter-spacing: -0.02em;
          position: relative;
          z-index: 1;
          background: linear-gradient(135deg, #fff 0%, #cbd5e1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .tc-login-brand .tc-brand-sub {
          font-size: 18px;
          color: #94a3b8;
          margin: 0 0 56px 0;
          position: relative;
          z-index: 1;
        }

        .tc-login-brand .tc-brand-features {
          display: flex;
          flex-direction: column;
          gap: 14px;
          font-size: 14px;
          color: #cbd5e1;
          position: relative;
          z-index: 1;
        }

        .tc-login-brand .tc-brand-features span {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .tc-login-brand .tc-brand-features span::before {
          content: '✓';
          color: #6366f1;
          font-weight: 700;
          font-size: 16px;
          width: 18px;
          height: 18px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: rgba(99, 102, 241, 0.15);
          border-radius: 4px;
          flex-shrink: 0;
        }

        .tc-login-brand .tc-brand-footer {
          position: absolute;
          bottom: 32px;
          left: 0;
          right: 0;
          text-align: center;
          font-size: 12px;
          color: #64748b;
          z-index: 1;
        }

        /* 右侧表单区 */
        .tc-login-form {
          flex: 1;
          max-width: 520px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 64px 72px;
          box-sizing: border-box;
          background: #1c1c22;
          position: relative;
          border-left: 1px solid rgba(255, 255, 255, 0.04);
        }

        .tc-login-form h2 {
          font-size: 32px;
          margin: 0 0 12px 0;
          font-weight: 600;
          letter-spacing: -0.01em;
          color: #f9fafb;
        }

        .tc-login-form .tc-form-tip {
          font-size: 14px;
          color: #cbd5e1;
          margin: 0 0 32px 0;
        }

        .tc-login-form .tc-form-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          margin-bottom: 8px;
        }

        .tc-login-form .tc-form-header a {
          font-size: 13px;
          color: #94a3b8;
          text-decoration: none;
          transition: color 0.15s;
        }

        .tc-login-form .tc-form-header a:hover {
          color: #f3f4f6;
        }

        .tc-login-form .tc-form-input {
          width: 100%;
          height: 48px;
          padding: 0 16px;
          background: #2a2a33;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 10px;
          color: #f9fafb;
          font-size: 14px;
          margin-bottom: 16px;
          box-sizing: border-box;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }

        .tc-login-form .tc-form-input:focus {
          outline: none;
          border-color: #6366f1;
          background: #303040;
          box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18);
        }

        .tc-login-form .tc-form-input::placeholder {
          color: #94a3b8;
        }

        .tc-login-form .tc-form-actions {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: -8px 0 24px 0;
          font-size: 13px;
        }

        .tc-login-form .tc-form-actions label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #cbd5e1;
          cursor: pointer;
        }

        .tc-login-form .tc-form-actions input[type="checkbox"] {
          accent-color: #6366f1;
          width: 14px;
          height: 14px;
        }

        .tc-login-form .tc-form-actions a {
          color: #a5b4fc;
          text-decoration: none;
        }

        .tc-login-form .tc-form-actions a:hover {
          color: #c7d2fe;
          text-decoration: underline;
        }

        .tc-login-primary-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 48px;
          padding: 0 20px;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.05s, box-shadow 0.15s;
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
        }

        .tc-login-primary-btn:hover {
          box-shadow: 0 6px 24px rgba(99, 102, 241, 0.45);
        }

        .tc-login-primary-btn:active {
          transform: scale(0.98);
        }

        .tc-login-primary-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .tc-login-form .tc-form-error {
          font-size: 13px;
          color: #fecaca;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          padding: 8px 12px;
          margin: -8px 0 16px 0;
        }

        .tc-login-form .tc-form-footnote {
          font-size: 12px;
          color: #94a3b8;
          margin: 32px 0 0 0;
          text-align: center;
        }

        .tc-login-form .tc-form-footnote a {
          color: #cbd5e1;
          text-decoration: none;
          margin: 0 4px;
        }

        .tc-login-form .tc-form-footnote a:hover {
          color: #f3f4f6;
          text-decoration: underline;
        }
      `}</style>

      <div className="tc-login-brand">
        <div className="tc-brand-tags">
          <span className="tc-brand-tag">OpenSumi</span>
          <span className="tc-brand-tag">OpenCode</span>
          <span className="tc-brand-tag">Kubernetes</span>
        </div>
        <div className="tc-login-logo">T</div>
        <h1>太初 (Taichu)</h1>
        <p className="tc-brand-sub">企业级 Agent 平台</p>
        <div className="tc-brand-features">
          <span>多租户隔离 / 沙箱环境</span>
          <span>插件市场 / VS Code 兼容扩展</span>
          <span>智能任务编排 / OpenCode 集成</span>
          <span>即用即回收 / 自动化运维</span>
        </div>
        <div className="tc-brand-footer">© 2026 Taichu</div>
      </div>

      <div className="tc-login-form">
        <form onSubmit={handleUsernameLogin}>
          <div className="tc-form-header">
            <h2>登录</h2>
            <a href="#">没有账号? 联系我们</a>
          </div>
          <p className="tc-form-tip">登录后即可使用全部功能</p>

          <input
            type="text"
            placeholder="用户名 / 用户 ID"
            className="tc-form-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            type="password"
            placeholder="密码"
            className="tc-form-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="tc-form-actions">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              记住我
            </label>
            <a href="#">忘记密码?</a>
          </div>

          {error && <div className="tc-form-error">{error}</div>}

          <button
            type="submit"
            className="tc-login-primary-btn"
            disabled={!username.trim() || !password}
          >
            登录
          </button>
        </form>

        <p className="tc-form-footnote">
          登录即同意 <a href="#">用户协议</a> 和 <a href="#">隐私政策</a>
        </p>
      </div>
    </div>
  );
};