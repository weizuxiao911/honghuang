import React, { useContext, useLayoutEffect } from 'react';
import { SlotLocation } from '@opensumi/ide-core-browser';
import { PanelContext } from '@opensumi/ide-core-browser/lib/components';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks/injectable-hooks';
import type { ComponentRegistryInfo } from '@opensumi/ide-core-browser/lib/layout/layout.interface';
import { TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';
import { TabbarConfig } from '@opensumi/ide-main-layout/lib/browser/tabbar/renderer.view';
import { RightTabPanelRenderer } from '@opensumi/ide-main-layout/lib/browser/tabbar/panel.view';

import { RightTopTabbarView } from './RightTopTabbarView';

/**
 * 右侧面板自定义 slot renderer — 覆盖 SlotLocation.right 默认渲染器
 *
 * 默认 RightTabRenderer 结构 = 竖 icon 栏 (bar) + 面板;
 * 这里改为: 面板 + 顶部 tab 横条 (无竖 icon 栏, 折叠后右侧整列消失)
 *
 * 组装逻辑抄自框架 TabRendererBase (registerResizeHandle / registerContainer /
 * updatePanelVisibility / ensureViewReady), 面板内容复用 RightTabPanelRenderer.
 */
export const RightPanelRenderer: React.FC<{ components: ComponentRegistryInfo[] }> = ({ components }) => {
  const tabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
  const resizeHandle = useContext(PanelContext);

  useLayoutEffect(() => {
    tabbarService.registerResizeHandle(resizeHandle);
    components.forEach((component) => {
      const containerId = component.options?.containerId;
      if (containerId) {
        tabbarService.registerContainer(containerId, component);
      }
    });
    tabbarService.updatePanelVisibility();
    tabbarService.ensureViewReady();
  }, [components]);

  return (
    <div className="tc-right-panel">
      <style>{`
        .tc-right-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background: var(--panel-background, #0e0e12);
          color: var(--foreground, #e5e7eb);
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
        }
        /* 顶部 tab 横条隐藏: AiPanel 自带顶栏 (Taichu brand + 历史/新建) */
        .tc-right-panel .tc-right-tabbar {
          display: none !important;
        }
        /* 隐藏 OpenSumi 面板标题条 ("AI 助手"), AiPanel 顶栏已含标题 */
        .tc-right-panel .kt-accordion-panel-titlebar,
        .tc-right-panel .design-titlebar___jveiR,
        .tc-right-panel [class*="titlebar___"] {
          display: none !important;
        }
        .tc-right-panel__body {
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .tc-right-panel__body > * {
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
        .tc-right-panel__body .kt-tab-panel {
          flex: 1 1 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }
      `}</style>
      <TabbarConfig.Provider
        value={{
          side: SlotLocation.right,
          direction: 'right-to-left',
          fullSize: 0,
        }}
      >
        <RightTopTabbarView />
        <div className="tc-right-panel__body">
          <RightTabPanelRenderer />
        </div>
      </TabbarConfig.Provider>
    </div>
  );
};
