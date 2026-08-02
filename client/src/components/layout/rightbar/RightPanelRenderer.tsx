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
          background: var(--panel-background, #0e0e12);
          color: var(--foreground, #e5e7eb);
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          user-select: none;
        }
        .tc-right-tabbar {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 32px;
          padding: 0 8px;
          flex-shrink: 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }
        .tc-right-tabbar__tab {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 24px;
          padding: 0 10px;
          border: none;
          background: transparent;
          color: var(--descriptionForeground, #8b929b);
          font-size: 12px;
          cursor: pointer;
          border-radius: 4px;
          transition: color 0.15s, background 0.15s;
        }
        .tc-right-tabbar__tab:hover {
          color: var(--foreground, #e5e7eb);
          background: rgba(255, 255, 255, 0.06);
        }
        .tc-right-tabbar__tab.is-active {
          color: #c7d2fe;
          background: rgba(99, 102, 241, 0.14);
        }
        .tc-right-tabbar__tab .codicon {
          font-size: 14px;
        }
        .tc-right-panel__body {
          flex: 1;
          min-height: 0;
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
