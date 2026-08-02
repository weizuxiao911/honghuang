import React, { useState, useEffect } from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

import { LoginLayout } from '../login/LoginLayout';

/**
 * 客户端默认 LayoutComponent — 由 CodeBlitz AppRenderer 渲染
 *
 * 装配逻辑:
 *   - 始终渲染 IDE 骨架 (顶部 TopBar + 左/中/右/底部 SplitPanel + 状态栏);
 *     默认访问 taichu 页面即看到完整 IDE, **无需登录**
 *   - login 槽位作为 full-screen overlay 装在 IDE 骨架之上, 默认 hidden
 *   - 三个 layout slot (left / right / bottom) 通过 Hook OpenSumi LayoutService
 *     双向联动:
 *       - TopBar toggle 按钮 → dispatch 'taichu:layout-{side}-toggle' →
 *         LayoutComponent 调 layoutService.toggleSlot / expandBottom
 *       - panel 自身折叠/展开 → TabbarService.onSizeChange →
 *         layoutService.isVisible 变化 → LayoutComponent 同步 state →
 *         dispatch 'taichu:layout-{side}-changed' → TopBar 同步 icon
 */
export function LayoutComponent(): React.ReactElement {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const [leftVisible, setLeftVisible] = useState<boolean>(true);
  const [rightVisible, setRightVisible] = useState<boolean>(true);
  const [bottomVisible, setBottomVisible] = useState<boolean>(true);

  // 监听 OpenSumi LayoutService 状态变化 (panel 自身折叠/展开 + TopBar toggle 都会触发)
  useEffect(() => {
    const syncLeft = () => {
      const visible = layoutService.isVisible(SlotLocation.left);
      setLeftVisible(visible);
      window.dispatchEvent(
        new CustomEvent('taichu:layout-left-changed', { detail: { visible } })
      );
    };
    const syncRight = () => {
      const visible = layoutService.isVisible(SlotLocation.right);
      setRightVisible(visible);
      window.dispatchEvent(
        new CustomEvent('taichu:layout-right-changed', { detail: { visible } })
      );
    };
    // 初始同步
    syncLeft();
    syncRight();

    // 监听 TabbarService.onCurrentChange (currentContainerId 切换触发, panel header 折叠按钮)
    // 也监听 onSizeChange (用户拖拽 panel split 边界, panel 折叠到 0)
    const leftTabbar = layoutService.getTabbarService(SlotLocation.left);
    const rightTabbar = layoutService.getTabbarService(SlotLocation.right);
    const leftDisposable = leftTabbar.onCurrentChange(syncLeft);
    const rightDisposable = rightTabbar.onCurrentChange(syncRight);
    const leftSizeDisposable = leftTabbar.onSizeChange(syncLeft);
    const rightSizeDisposable = rightTabbar.onSizeChange(syncRight);

    return () => {
      leftDisposable.dispose();
      rightDisposable.dispose();
      leftSizeDisposable.dispose();
      rightSizeDisposable.dispose();
    };
  }, [layoutService]);

  // TopBar toggle 按钮触发: 调 OpenSumi LayoutService.toggleSlot (left/right)
  // bottom 用 local state 控制 (OpenSumi 的 bottom slot 没注册 resizeHandle, 无法响应 panel 显隐)
  useEffect(() => {
    const leftHandler = () => layoutService.toggleSlot(SlotLocation.left);
    const rightHandler = () => layoutService.toggleSlot(SlotLocation.right);
    const bottomHandler = () => {
      // bottom 用 local state + 调 updatePanelVisibility 触发实际 panel 显隐
      setBottomVisible((v) => {
        const newVisible = !v;
        // 调 OpenSumi 的 updatePanelVisibility 触发 resizeHandle.hidePanel
        const bottomTabbar = layoutService.getTabbarService(SlotLocation.bottom);
        bottomTabbar.updatePanelVisibility(newVisible);
        window.dispatchEvent(
          new CustomEvent('taichu:layout-bottom-changed', { detail: { visible: newVisible } })
        );
        return newVisible;
      });
    };

    window.addEventListener('taichu:layout-left-toggle', leftHandler);
    window.addEventListener('taichu:layout-right-toggle', rightHandler);
    window.addEventListener('taichu:layout-bottom-toggle', bottomHandler);

    return () => {
      window.removeEventListener('taichu:layout-left-toggle', leftHandler);
      window.removeEventListener('taichu:layout-right-toggle', rightHandler);
      window.removeEventListener('taichu:layout-bottom-toggle', bottomHandler);
    };
  }, [layoutService]);

  return (
    <React.Fragment>
      {/* IDE 骨架 (始终显示) */}
      <BoxPanel direction="top-to-bottom">
        <SlotRenderer slot="top" />
        <SplitPanel
          overflow="hidden"
          id="main-horizontal"
          flex={1}
        >
          <SlotRenderer
            slot={SlotLocation.left}
            isTabbar
            defaultSize={280}
            minResize={204}
            minSize={49}
          />
          <SplitPanel
            id="main-vertical"
            minResize={300}
            flexGrow={1}
            direction="top-to-bottom"
          >
            <SlotRenderer
              flex={2}
              flexGrow={1}
              minResize={200}
              slot={SlotLocation.main}
            />
            <SlotRenderer
              flex={1}
              minResize={160}
              slot={SlotLocation.bottom}
              isTabbar
              defaultSize={200}
            />
          </SplitPanel>
          <SlotRenderer
            slot={SlotLocation.right}
            isTabbar
            defaultSize={420}
            minResize={280}
            minSize={49}
          />
        </SplitPanel>
        <SlotRenderer slot={SlotLocation.statusBar} />
      </BoxPanel>
      {/* login 槽位 overlay (默认 hidden, 操作触发时显示) */}
      <LoginLayout />
    </React.Fragment>
  );
}
