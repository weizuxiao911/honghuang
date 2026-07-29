import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, getStorageValue, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

export function LayoutComponent(): React.ReactElement {
  const { layout } = getStorageValue() as any;
  const leftId = layout?.left?.currentId;
  const rightId = layout?.right?.currentId;
  const leftSize = leftId ? layout?.left?.size || 280 : 49;
  const rightSize = rightId ? layout?.right?.size || 360 : 49;

  return React.createElement(
    BoxPanel,
    { direction: 'top-to-bottom' },
    React.createElement(SlotRenderer, { slot: SlotLocation.top }),
    React.createElement(
      SplitPanel,
      { overflow: 'hidden', id: 'main-horizontal', flex: 1 },
      React.createElement(SlotRenderer, {
        slot: SlotLocation.left,
        defaultSize: leftSize,
        minResize: 204,
        minSize: 49,
      }),
      React.createElement(
        SplitPanel,
        { id: 'main-vertical', minResize: 300, flexGrow: 1, direction: 'top-to-bottom' },
        React.createElement(SlotRenderer, { flex: 2, flexGrow: 1, minResize: 200, slot: SlotLocation.main }),
        React.createElement(SlotRenderer, {
          flex: 1,
          minResize: 160,
          slot: SlotLocation.bottom,
          defaultSize: layout?.bottom?.currentId ? layout?.bottom?.size : 24,
        })
      ),
      React.createElement(SlotRenderer, {
        slot: SlotLocation.right,
        defaultSize: rightSize,
        minResize: 280,
        minSize: 49,
      })
    ),
    React.createElement(SlotRenderer, { slot: SlotLocation.statusBar })
  );
}
