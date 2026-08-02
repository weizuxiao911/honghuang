import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { AiPanel } from './AiPanel';

/**
 * AI 助手 — right 槽位默认 webview (components/ai/)
 *
 * 与 login/user 同机制 (走 OpenSumi 标准槽位):
 *   - AiContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('ai-panel-default', { id, component: AiPanel })
 *   - AiModule (BrowserModule + contributionProvider = ComponentContribution)
 *     通过 appConfig.modules: [AiModule] 注入 DI
 *   - slots.ts 的 layoutConfig['right'].modules = ['ai-panel-default']
 *   - RightPanelRenderer (components/layout/rightbar/) 渲染 right 槽位,
 *     面板内容 = AiPanel (聊天 UI)
 *
 * 能力 (SDK 封装在 commands/ai/):
 *   - 新会话 / 历史会话 / 聊天 (SSE 打字机)
 *   - A2UI question / subagent 切换
 *   - 数据流经 window.__TAICHU_OPENCODE__ (SDK client, commands/opencode 事件驱动)
 *
 * 可被业务 VSIX 通过 contributes.views + viewsContainers 注册自定义 view 替换 (铁律 12).
 */
@Injectable()
@Domain(ComponentContribution)
export class AiContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('ai-panel-default', {
      id: 'ai-panel-default',
      component: AiPanel,
    }, {
      containerId: 'ai-panel-default',
      iconClass: 'codicon codicon-sparkle',
      title: 'AI 助手',
    });
  }
}

@Injectable()
export class AiModule extends BrowserModule {
  providers = [AiContribution];

  contributionProvider = ComponentContribution;
}