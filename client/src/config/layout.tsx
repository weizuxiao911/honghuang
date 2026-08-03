import React, { useEffect } from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common';

/**
 * 客户端默认 LayoutComponent — config/layout.tsx (容器装配配置目录)
 *
 * IDE 布局骨架:
 *   - top-to-bottom BoxPanel: top 槽位 (菜单栏, 空) + 主 SplitPanel
 *   - main-horizontal: left (文件树) + main-vertical (main 编辑器 + bottom 面板) + right (AI 助手)
 *   - action 槽位由 OpenSumi 顶栏 (ide-menu-bar / 框架 TopBar) 内部渲染,
 *     LayoutComponent 不直接渲染 action (action 是 top 横条右侧区)
 *   - login / userPage 槽位: client 自定义槽位, SlotRenderer 渲染
 *
 * 槽位 id 用 OpenSumi 标准 id (left / right / bottom),
*/
export function LayoutComponent(): React.ReactElement {
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  // 右侧 AI 面板固定默认宽度 438
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const right = layoutService.getTabbarService(SlotLocation.right);
        right.resizeHandle?.setSize(438);
      } catch {
        /* ignore */
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [layoutService]);

  // 左侧栏 + 右侧栏默认展开 (文件树 + AI 面板), 不随登录态折叠
  useEffect(() => {
    const apply = () => {
      try {
        layoutService.toggleSlot(SlotLocation.left, true);
        layoutService.toggleSlot(SlotLocation.right, true);
      } catch {
        /* ignore */
      }
    };
    // 延迟等布局就绪 (OpenSumi 布局未 ready 时 toggleSlot 无效)
    const timer = setTimeout(apply, 500);
    window.addEventListener('taichu:login-session-changed', apply);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('taichu:login-session-changed', apply);
    };
  }, [layoutService]);

  return (
    <React.Fragment>
      <BoxPanel direction="top-to-bottom">
        <SlotRenderer slot="top" />
        <SplitPanel overflow="hidden" id="main-horizontal" flex={1}>
          <SlotRenderer
            slot={SlotLocation.left}
            isTabbar
            defaultSize={286}
            minResize={204}
            minSize={49}
          />
          <SplitPanel id="main-vertical" minResize={300} flexGrow={1} direction="top-to-bottom">
            <SlotRenderer flex={2} flexGrow={1} minResize={200} slot={SlotLocation.main} />
            <SlotRenderer flex={1} minResize={160} slot={SlotLocation.bottom} isTabbar defaultSize={200} />
          </SplitPanel>
          <SlotRenderer slot={SlotLocation.right} isTabbar defaultSize={438} minResize={320} minSize={49} />
        </SplitPanel>
      </BoxPanel>
      <SlotRenderer slot="login" />
      <SlotRenderer slot="user" />
      <SlotRenderer slot="loading" />
      <SlotRenderer slot="toast" />
    </React.Fragment>
  );
}
