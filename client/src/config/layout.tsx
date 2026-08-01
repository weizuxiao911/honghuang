import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

/**
 * client 默认 LayoutComponent — 由 CodeBlitz 在 layoutConfig[SlotLocation.*] 之外提供顶层布局壳。
 *
 * 装配顺序: 顶部 slot (由 SlotRenderer 渲染, TopBar 通过 ComponentRegistry 注册进 top slot)
 *   → 主区(left / main / bottom / right 四块 SplitPanel) → 底部 statusBar
 *
 * 设计定位: client 提供框架级 chrome (TopBar 注册为 top slot 模块, 与官方
 *   @opensumi/ide-menu-bar 同一机制), 不写业务逻辑; 其他 slot 内容由 VSIX 通过
 *   contributes.views / viewsContainers + sumiContributes.browserViews.{slot} 注入。
 */
export function LayoutComponent(): React.ReactElement {
  return React.createElement(
    BoxPanel,
    { direction: 'top-to-bottom' },
    // 顶部 slot — TopBar 已在 App.tsx onLoad 里 ComponentRegistry.register('tc-topbar', ...)
    // slots.ts 的 layoutConfig[SlotLocation.top].modules = ['tc-topbar']
    React.createElement(SlotRenderer as any, { slot: 'top' }),
    React.createElement(
      SplitPanel,
      { overflow: 'hidden', id: 'main-horizontal', flex: 1 },
      React.createElement(SlotRenderer as any, {
        slot: SlotLocation.left,
        isTabbar: true,
        defaultSize: 280,
        minResize: 204,
        minSize: 49,
      }),
      React.createElement(
        SplitPanel,
        { id: 'main-vertical', minResize: 300, flexGrow: 1, direction: 'top-to-bottom' },
        React.createElement(SlotRenderer, { flex: 2, flexGrow: 1, minResize: 200, slot: SlotLocation.main }),
        React.createElement(SlotRenderer as any, {
          flex: 1,
          minResize: 160,
          slot: SlotLocation.bottom,
          isTabbar: true,
          defaultSize: 200,
        }),
      ),
      React.createElement(SlotRenderer as any, {
        slot: SlotLocation.right,
        isTabbar: true,
        defaultSize: 420,
        minResize: 280,
        minSize: 49,
      }),
    ),
    React.createElement(SlotRenderer, { slot: SlotLocation.statusBar }),
  );
}