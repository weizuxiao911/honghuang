import React from 'react';

/**
 * 右侧栏 (rightbar) 容器占位 view
 *
 * client 框架内置一个空 rightbar 容器, 业务 VSIX 通过:
 *   - VS Code 标准: contributes.views + contributes.viewsContainers 注册 view container
 *     (type='rightbar' 由 client 框架按 VS Code 标准暴露, 铁律 12)
 *   - OpenSumi 私有标准: sumiContributes.browserViews.rightBar 注册 view
 *
 * 两种方式都会被 client 框架识别并渲染到 rightbar 槽位; 本 view 仅作兜底.
 */
export const RightBar: React.FC = () => {
  return (
    <div
      style={{
        height: '100%',
        background: '#0e0e12',
        color: '#6b7280',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '8px',
        fontSize: '12px',
        userSelect: 'none',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '24px', opacity: 0.4 }}>📦</div>
      <div>rightbar 容器</div>
      <div style={{ fontSize: '11px', opacity: 0.7 }}>
        业务 VSIX 可注册 view 注入
      </div>
    </div>
  );
};
