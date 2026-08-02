import React, { useLayoutEffect, useRef } from 'react';
import { useAutorun, useInjectable, fastdom, SlotLocation } from '@opensumi/ide-core-browser';
import { Layout } from '@opensumi/ide-core-browser/lib/components/layout/layout';
import { TabbarServiceFactory } from '@opensumi/ide-main-layout/lib/browser/tabbar/tabbar.service';

/**
 * 右侧面板顶部 tab 条 — 替代 OpenSumi 默认的右侧竖 icon 栏
 *
 * 需求: 右侧只保留面板, 不要最右侧的竖 icon 栏 (bar)
 *   - tab 条目横排渲染在面板顶部 (图标 + 标题)
 *   - 点击当前 tab → 折叠 (currentContainerId=''), 面板完全消失
 *   - 折叠宽度依赖 barSize: 这里上报 barSize = 0 (measureRef 宽 0),
 *     折叠时 TabbarService.setSize(0) + display:none → 右侧整列消失
 */
export const RightTopTabbarView: React.FC = () => {
  const tabbarService = useInjectable(TabbarServiceFactory)(SlotLocation.right);
  const currentContainerId = useAutorun(tabbarService.currentContainerId);
  const measureRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    fastdom.measure(() => {
      if (measureRef.current) {
        tabbarService.updateBarSize(measureRef.current[Layout.getDomSizeProperty('right-to-left')]);
      }
    });
  }, [tabbarService]);

  return (
    <div className="tc-right-tabbar">
      {/* 0 宽测量元素: barSize 上报为 0, 折叠时右侧面板完全消失 */}
      <div ref={measureRef} style={{ width: 0, height: 0 }} />
      {tabbarService.visibleContainers.map((component) => {
        const containerId = component.options?.containerId;
        if (!containerId) {
          return null;
        }
        const active = currentContainerId === containerId;
        return (
          <button
            key={containerId}
            className={`tc-right-tabbar__tab${active ? ' is-active' : ''}`}
            title={component.options?.title}
            onClick={() => tabbarService.updateCurrentContainerId(active ? '' : containerId)}
          >
            {component.options?.iconClass ? (
              <span className={component.options.iconClass} />
            ) : null}
            <span>{component.options?.title}</span>
          </button>
        );
      })}
    </div>
  );
};
