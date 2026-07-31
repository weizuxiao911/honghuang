import React from 'react';

/**
 * Taichu欢迎页
 * 覆盖 CodeBlitz 默认 editor-empty 组件（Codeblitz logo + slogan）。
 */
export const WelcomePage: React.FC = () => {
  return (
    <div className="app-welcome">
      <style>{`
        .app-welcome {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: transparent;
          color: var(--foreground);
          user-select: none;
        }
        .app-welcome__brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 48px;
        }
        .app-welcome__logo {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 28px;
          font-weight: 600;
          letter-spacing: -0.02em;
          box-shadow: 0 8px 24px rgba(99, 102, 241, 0.28);
        }
        .app-welcome__title {
          font-size: 28px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: var(--foreground);
        }
        .app-welcome__subtitle {
          font-size: 13px;
          color: var(--descriptionForeground);
          line-height: 1.6;
        }
        .app-welcome__hints {
          display: flex;
          gap: 24px;
          margin-top: 8px;
        }
        .app-welcome__hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--descriptionForeground);
        }
        .app-welcome__kbd {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .app-welcome__kbd kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 11px;
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          color: var(--foreground);
        }
      `}</style>
      <div className="app-welcome__brand">
        <div className="app-welcome__logo">T</div>
        <div className="app-welcome__title">Taichu</div>
        <div className="app-welcome__subtitle">开箱即用通用 Agent 产品基座</div>
      </div>
      <div className="app-welcome__hints">
        <div className="app-welcome__hint">
          <span>与 AI 对话</span>
          <span className="app-welcome__kbd">
            <kbd>⌘</kbd>
            <kbd>U</kbd>
          </span>
        </div>
        <div className="app-welcome__hint">
          <span>Editor 内 AI 编码</span>
          <span className="app-welcome__kbd">
            <kbd>⌘</kbd>
            <kbd>I</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
