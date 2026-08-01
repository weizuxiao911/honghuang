import React from 'react';

/**
 * Taichu TopBar — 框架级顶部 chrome
 *
 * 设计原则:
 *   - 不写业务逻辑 / 不直接调 opencode / 不注入 runtime
 *   - 不订阅 VSIX 事件 / 不编排槽位
 *   - 纯 UI 壳: 品牌 + 工作区切换占位 + 搜索框(UI only) + 右侧设置入口(占位)
 *   - 实际行为(工作区列表 / 搜索结果 / 设置项内容)由 VSIX 通过 contributes.commands / contributes.menus 注入
 *
 * 槽位: 在 client/src/config/layout.tsx 的 BoxPanel 顶部插入,框架 chrome 容器层
 * 槽位定义: SlotLocation.top (OpenSumi 私有, 框架已建 slot)
 */
export const TopBar: React.FC = () => {
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
        .tc-topbar__left, .tc-topbar__right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .tc-topbar__brand {
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .tc-topbar__workspace {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          border-radius: 4px;
          cursor: pointer;
        }
        .tc-topbar__workspace:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .tc-topbar__search {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          width: 240px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--descriptionForeground, #8b929b);
        }
        .tc-topbar__icon-btn {
          width: 28px;
          height: 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          cursor: pointer;
        }
        .tc-topbar__icon-btn:hover {
          background: rgba(255, 255, 255, 0.06);
        }
      `}</style>
      <div className="tc-topbar__left">
        <span className="tc-topbar__brand">太初</span>
        <span className="tc-topbar__workspace" title="工作区(由 VSIX 注入)">
          选择工作区
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="tc-topbar__search" title="搜索(由 VSIX 注入)">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="5.5" cy="5.5" r="3.8" stroke="currentColor" strokeWidth="1.2" />
            <path d="M8.5 8.5L11 11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          搜索
        </span>
      </div>
      <div className="tc-topbar__right">
        <span className="tc-topbar__icon-btn" title="设置(由 VSIX 注入)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2" />
            <path
              d="M7 1V3M7 11V13M13 7H11M3 7H1M11.3 2.7L9.9 4.1M4.1 9.9L2.7 11.3M11.3 11.3L9.9 9.9M4.1 4.1L2.7 2.7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </div>
    </div>
  );
};
