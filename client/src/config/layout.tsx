import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

import { TopBar } from '../components/TopBar';

/**
 * client 默认 LayoutComponent — 由 CodeBlitz 在 layoutConfig[SlotLocation.*] 之外提供顶层布局壳。
 *
 * 装配顺序: 顶部 TopBar (框架 chrome) → 主区(left / main / bottom / right 四块 SplitPanel) → 底部 statusBar
 *
 * 设计定位: client 提供框架级 chrome (TopBar), 不写业务逻辑; SlotRenderer 留给 VSIX 通过
 *   contributes.views / viewsContainers + sumiContributes.browserViews.{slot} 注入具体内容。
 */
export function LayoutComponent(): React.ReactElement {
  return React.createElement(
    BoxPanel,
    { direction: 'top-to-bottom' },
    // 顶部框架 chrome (太初品牌 + 工作区/搜索/设置占位, 实际行为由 VSIX 注入)
    React.createElement(TopBar, null),
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