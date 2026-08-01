import React from 'react';

/**
 * Taichu欢迎页
 * 覆盖 CodeBlitz 默认 editor-empty 组件。品牌区为 taowhale 风格
 * 大字 marquee 横向滚动效果（无缝循环）。
 */
export const WelcomePage: React.FC = () => {
  // 重复一次实现无缝 marquee
  const marqueePhrase =
    'Taichu · The open foundation for universal Agent products · 通用 Agent 产品基座 · ';
  const marquee = marqueePhrase.repeat(4);
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
          gap: 32px;
        }
        .app-welcome__marquee {
          overflow: hidden;
          width: 100%;
          -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%);
          mask-image: linear-gradient(90deg, transparent 0, #000 8%, #000 92%, transparent 100%);
        }
        .app-welcome__marquee-track {
          display: inline-flex;
          white-space: nowrap;
          animation: app-marquee 28s linear infinite;
          will-change: transform;
        }
        .app-welcome__marquee-text {
          font-size: 52px;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1.1;
          background: linear-gradient(90deg, #ffffff 0%, rgba(255,255,255,.85) 50%, #ffffff 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        @keyframes app-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        .app-welcome__sub {
          font-size: 12px;
          color: var(--descriptionForeground);
          letter-spacing: 0.04em;
          font-weight: 300;
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
      <div className="app-welcome__marquee">
        <div className="app-welcome__marquee-track">
          <span className="app-welcome__marquee-text">{marquee}</span>
        </div>
      </div>
      <div className="app-welcome__sub">/ 开箱即用通用 Agent 产品基座</div>
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
