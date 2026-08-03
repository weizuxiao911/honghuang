import React from 'react';

/**
 * bottom slot placeholder view — 仅用于让 layoutConfig[bottom] 有 module,
 * 触发 layoutService.toggleSlot(bottom) 时能正确切换 isVisible 状态.
 *
 * 实际业务内容由业务 VSIX 注入 (例: 问题/输出/终端/调试控制台);
 * 暂无业务 VSIX 时, 这里显示一个空白占位.
 */
export const BottomPlaceholder: React.FC = () => {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6b7280',
        fontSize: '12px',
        userSelect: 'none',
      }}
    >
      {/* bottom slot 占位 — 业务 VSIX 后续会注入"问题/输出/终端"等面板 */}
    </div>
  );
};
