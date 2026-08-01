import React from 'react';

/**
 * Taichu TopBar — 框架级顶部 chrome
 *
 * 设计原则:
 *   - 不写业务逻辑 / 不直接调 opencode / 不注入 runtime
 *   - 不订阅 VSIX 事件 / 不编排槽位
 *   - 当前为空容器(36px 高, 透明背景), 内容由 VSIX 通过 contributes.commands / contributes.menus 注入
 *
 * 槽位: 在 client/src/config/layout.tsx 的 BoxPanel 顶部插入,框架 chrome 容器层
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
      `}</style>
    </div>
  );
};
