import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule, SlotLocation } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';
import { SlotRendererRegistry, SlotRendererContribution } from '@opensumi/ide-core-browser';

import { RightBar } from './RightBar';
import { RightPanelRenderer } from './RightPanelRenderer';

/**
 * 右侧栏 (rightbar) 槽位 Module — 跟 BottomModule 同一模式
 *
 * 注册 'rightbar-default' view, 让 layoutConfig[SlotLocation.right].modules
 * 有 module 可注册, 触发 layoutService.toggleSlot(right) 时能正确切换 isVisible.
 *
 * 实际业务内容由业务 VSIX 注入 (例: AI 助手 / Chat 面板 / Output):
 *   - VS Code 标准: contributes.views + contributes.viewsContainers 注册 view container
 *   - OpenSumi 私有标准: sumiContributes.browserViews.right 注册 view
 *
 * 现在还没做 ai 功能, RightBar 是个空容器; 后续 AI Panel 接入时,
 * 可作为 client 默认 (跟 BottomModule 的 'tc-problems' 类似),
 * 也可让 VSIX 接管 (跟 login 槽位类似).
 *
 * 渲染器: RightBarRendererContribution 覆盖 SlotLocation.right 默认渲染器
 * (默认是 竖 icon 栏 + 面板), 改为 面板 + 顶部 tab 横条, 折叠后整列消失,
 * 不保留右侧竖 icon 栏.
 */
@Injectable()
@Domain(ComponentContribution)
export class RightBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('rightbar-default', {
      id: 'rightbar-default',
      component: RightBar,
    }, {
      // tabbar 容器必需: containerId 与注册 key 一致, iconClass/title 渲染在 tab 上
      containerId: 'rightbar-default',
      iconClass: 'codicon codicon-sparkle',
      title: 'AI 助手',
    });
  }
}

@Injectable()
@Domain(SlotRendererContribution)
export class RightBarRendererContribution implements SlotRendererContribution {
  registerRenderer(registry: SlotRendererRegistry): void {
    registry.registerSlotRenderer(SlotLocation.right, RightPanelRenderer);
  }
}

@Injectable()
export class RightBarModule extends BrowserModule {
  providers = [RightBarContribution, RightBarRendererContribution];

  contributionProvider = [ComponentContribution, SlotRendererContribution];
}
