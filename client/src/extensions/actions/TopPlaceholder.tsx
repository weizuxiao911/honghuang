import React from 'react';

/**
 * TopPlaceholder — top 槽位占位 (extensions/actions/)
 *
 * top 槽位为空时 OpenSumi 不渲染顶栏横条, action 槽位 (顶栏右侧) 也无处显示.
 * 本组件透明占位撑起顶栏高度 (36px), 让框架渲染顶栏, action 显示在右侧.
 */
export const TopPlaceholder: React.FC = () => {
  return <div style={{ width: '100%', height: '100%' }} />;
};
