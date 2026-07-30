import React from 'react';

/**
 * 洪荒欢迎页
 * 覆盖 CodeBlitz 默认 editor-empty 组件（Codeblitz logo + slogan）。
 * 抄 Trae 风格：纯深色底，中心 logo + 标语 + 快捷键卡片，无背景光晕。
 */
export const WelcomePage: React.FC = () => {
  return (
    <div className="zifu-welcome">
      <style>{`
        .zifu-welcome {
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
        .zifu-welcome__brand {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-bottom: 48px;
        }
        .zifu-welcome__logo {
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
        .zifu-welcome__title {
          font-size: 28px;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: var(--foreground);
        }
        .zifu-welcome__subtitle {
          font-size: 13px;
          color: var(--descriptionForeground);
          line-height: 1.6;
        }
        .zifu-welcome__hints {
          display: flex;
          gap: 24px;
          margin-top: 8px;
        }
        .zifu-welcome__hint {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: var(--descriptionForeground);
        }
        .zifu-welcome__kbd {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .zifu-welcome__kbd kbd {
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
      <div className="zifu-welcome__brand">
        <div className="zifu-welcome__logo">洪</div>
        <div className="zifu-welcome__title">洪荒</div>
        <div className="zifu-welcome__subtitle">开箱即用通用 Agent 产品基座</div>
      </div>
      <div className="zifu-welcome__hints">
        <div className="zifu-welcome__hint">
          <span>与 AI 对话</span>
          <span className="zifu-welcome__kbd">
            <kbd>⌘</kbd>
            <kbd>U</kbd>
          </span>
        </div>
        <div className="zifu-welcome__hint">
          <span>Editor 内 AI 编码</span>
          <span className="zifu-welcome__kbd">
            <kbd>⌘</kbd>
            <kbd>I</kbd>
          </span>
        </div>
      </div>
    </div>
  );
};
