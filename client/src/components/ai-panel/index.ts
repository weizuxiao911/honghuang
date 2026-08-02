import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { AiPanelView } from './AiPanel';

/**
 * ai-panel 槽位实现 — client 内置默认 AI 侧栏骨架
 *
 * 与 topbar 同一机制:
 *   - AiPanelContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('ai-panel-default', { id, component: AiPanelView })
 *   - AiPanelModule (BrowserModule + contributionProvider = ComponentContribution)
 *     通过 appConfig.modules: [AiPanelModule] 注入 DI
 *   - slots.ts 的 layoutConfig[SlotLocation.right].modules = ['ai-panel-default']
 *   - 业务 VSIX 通过 contributes.views + viewsContainers 注册自定义 view 替换默认
 *
 * 后续: 集成 @opencode-ai/sdk(全局)后, 注入 SDK 实例到 commands;
 * 现在仅做骨架, 内容由 VS Code 兼容辅助栏 VSIX 动态覆盖.
 */
@Injectable()
@Domain(ComponentContribution)
export class AiPanelContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('ai-panel-default', {
      id: 'ai-panel-default',
      component: AiPanelView,
    });
  }
}

@Injectable()
export class AiPanelModule extends BrowserModule {
  providers = [AiPanelContribution];

  contributionProvider = ComponentContribution;
}
