import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, getStorageValue, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

import { TopBar } from '../components/TopBar';

export function LayoutComponent(): React.ReactElement {
  const { layout } = getStorageValue() as any;
  // 首屏策略：左侧默认展开（280），右侧 chat 面板默认展开（420），底部折叠。
  // storage 里如果显式记录过尺寸就沿用；`fixLayout` 会把无 size 的记录清成 currentId=''，
  // 所以 truthy 判断只对已经拖动过的宽度生效。
  const leftSize = layout?.left?.currentId === '' ? 49 : layout?.left?.size || 280;
  const rightSize = layout?.right?.currentId === '' ? 49 : layout?.right?.size || 420;
  const bottomSize = layout?.bottom?.currentId ? layout?.bottom?.size || 200 : 24;

  return React.createElement(
    BoxPanel,
    { direction: 'top-to-bottom' },
    // 顶部 Trae 风格标题栏（React 组件替代 SlotRenderer）
    React.createElement(TopBar, null),
    React.createElement(
      SplitPanel,
      { overflow: 'hidden', id: 'main-horizontal', flex: 1 },
      React.createElement(SlotRenderer as any, {
        slot: SlotLocation.left,
        isTabbar: true,
        defaultSize: leftSize,
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
          defaultSize: bottomSize,
        })
      ),
      React.createElement(SlotRenderer as any, {
        slot: SlotLocation.right,
        isTabbar: true,
        defaultSize: rightSize,
        minResize: 280,
        minSize: 49,
      })
    ),
    React.createElement(SlotRenderer, { slot: SlotLocation.statusBar })
  );
}