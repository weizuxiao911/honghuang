import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { RightBar } from './RightBar';

/**
 * 右侧栏 (rightbar) 槽位 Module — 跟 BottomModule 同一模式
 *
 * 注册 'rightbar-default' view, 让 layoutConfig[SlotLocation.rightBar].modules
 * 有 module 可注册, 触发 layoutService.toggleSlot(rightBar) 时能正确切换 isVisible.
 *
 * 实际业务内容由业务 VSIX 注入 (例: AI 助手 / Chat 面板 / Output):
 *   - VS Code 标准: contributes.views + contributes.viewsContainers 注册 view container
 *   - OpenSumi 私有标准: sumiContributes.browserViews.rightBar 注册 view
 *
 * 现在还没做 ai 功能, RightBar 是个空容器; 后续 AI Panel 接入时,
 * 可作为 client 默认 (跟 BottomModule 的 'tc-problems' 类似),
 * 也可让 VSIX 接管 (跟 login 槽位类似).
 */
@Injectable()
@Domain(ComponentContribution)
export class RightBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('rightbar-default', {
      id: 'rightbar-default',
      component: RightBar,
    });
  }
}

@Injectable()
export class RightBarModule extends BrowserModule {
  providers = [RightBarContribution];

  contributionProvider = ComponentContribution;
}
