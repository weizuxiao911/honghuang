import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

/**
 * client 默认 LayoutComponent — 由 CodeBlitz 在 layoutConfig[SlotLocation.*] 之外提供顶层布局壳。
 *
 * 设计定位: client 是框架,不写自定义 chrome(TopBar / Sidebar / 状态栏等都走框架默认或 VSIX 注入);
 *   这里只保留框架默认 BoxPanel + SplitPanel 装配槽位,代码量最小。
 */
export function LayoutComponent(): React.ReactElement {
  return React.createElement(
    BoxPanel,
    { direction: 'top-to-bottom' },
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