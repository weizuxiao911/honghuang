import React, { useState, useEffect } from 'react';

/**
 * Taichu TopBar — 框架级顶部 chrome
 *
 * 设计原则:
 *   - 不写业务逻辑 / 不直接调 opencode / 不注入 runtime
 *   - 不订阅 VSIX 事件 / 不编排槽位
 *   - 当前含一个 36px 高的容器, 右侧放一个 toggle 按钮
 *   - 按钮 dispatch 'taichu:toggle-ai-panel' 事件, App.tsx onLoad 监听并调 LayoutService.toggleSlot('right')
 *
 * 槽位: 在 client/src/config/layout.tsx 的 BoxPanel 顶部插入,框架 chrome 容器层
 */
export const TopBar: React.FC = () => {
  const [rightVisible, setRightVisible] = useState<boolean>(true);

  // 监听 right slot 变化, 同步按钮状态(从 LayoutService.getTabbarService 拿)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.visible === 'boolean') {
        setRightVisible(detail.visible);
      }
    };
    window.addEventListener('taichu:right-slot-changed', handler);
    return () => window.removeEventListener('taichu:right-slot-changed', handler);
  }, []);

  const toggleAiPanel = () => {
    window.dispatchEvent(new CustomEvent('taichu:toggle-ai-panel'));
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
        .tc-topbar__right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .tc-topbar__btn {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: var(--descriptionForeground, #8b929b);
          cursor: pointer;
          border-radius: 4px;
        }
        .tc-topbar__btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: var(--foreground, #e5e7eb);
        }
        .tc-topbar__btn.is-active {
          color: var(--foreground, #e5e7eb);
          background: rgba(255, 255, 255, 0.04);
        }
        .tc-topbar__btn svg {
          width: 16px;
          height: 16px;
        }
      `}</style>
      <div className="tc-topbar__right">
        <button
          className={`tc-topbar__btn ${rightVisible ? 'is-active' : ''}`}
          title="切换 AI 面板"
          onClick={toggleAiPanel}
        >
          {rightVisible ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
              <line x1="6" y1="9" x2="12" y2="9" />
              <line x1="6" y1="13" x2="12" y2="13" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <line x1="15" y1="4" x2="15" y2="20" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};
