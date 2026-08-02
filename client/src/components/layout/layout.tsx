import React from 'react';
import { SlotLocation, SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

/**
 * 客户端默认 LayoutComponent — 由 CodeBlitz AppRenderer 渲染
 *
 * 装配逻辑:
 *   - 始终渲染 IDE 骨架 (顶部 TopBar + 左/中/右/底部 SplitPanel);
 *     默认访问 taichu 页面即看到完整 IDE, **无需登录**
 *   - login 槽位通过 <SlotRenderer slot="login"> 渲染, 与 left/right/bottom/top
 *     完全一致走 OpenSumi 标准槽位机制 (slots.ts 的 layoutConfig['login']
 *     默认注册 'login-default', 即 client 内置 LoginView)
 *   - 槽位内的 LoginView 自带 position:fixed 全屏 overlay + 自管显隐
 *     (taichu:login-show/hide/session-changed 三个事件)
 *   - 自定义 VSIX 通过 VS Code 标准 contributes.views + viewsContainers
 *     注册自定义 view container (type='login') 替换默认 LoginView
 *   - 三个 layout slot (left / right / bottom) 的折叠/展开/拖拽 resize
 *     由 OpenSumi 框架原生提供; TopBar 直连 IMainLayoutService.toggleSlot
 *   - 右侧 right slot 渲染器被 rightbar/RightPanelRenderer 覆盖:
 *     面板 + 顶部 tab 横条, 无竖 icon 栏 (折叠后整列消失)
 *   - 无状态栏 (statusBar slot 不渲染)
 *
 * 注意: slot 必须用标准 id (SlotLocation.left/right/bottom),
 * leftBar/rightBar/bottomBar 是框架 @deprecated 别名, 无面板渲染器.
 */
export function LayoutComponent(): React.ReactElement {
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
            defaultSize={335}
            minResize={280}
            minSize={49}
          />
        </SplitPanel>
      </BoxPanel>
      {/* login 槽位 (OpenSumi 标准槽位, 默认渲染 LoginView) */}
      <SlotRenderer slot="login" />
    </React.Fragment>
  );
}
