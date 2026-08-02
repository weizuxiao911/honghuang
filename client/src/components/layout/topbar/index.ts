import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { TopBar } from './TopBar';

/**
 * TopBar 插件 — 框架级顶部 chrome 的 slot 注册
 *
 * 与官方 @opensumi/ide-menu-bar 同一机制:
 *   - TopBarContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('tc-topbar', { id, component })
 *   - TopBarModule (BrowserModule + contributionProvider = ComponentContribution)
 *     通过 appConfig.modules: [TopBarModule] 注入 DI
 *   - slots.ts 的 layoutConfig[SlotLocation.top].modules = ['tc-topbar']
 *   - layout.tsx 的 SlotRenderer slot='top' 渲染
 *
 * 每个插件一个子目录 (client/src/components/{plugin}/), 本目录 = topbar 插件
 */
@Injectable()
@Domain(ComponentContribution)
export class TopBarContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('tc-topbar', {
      id: 'tc-topbar',
      component: TopBar,
    });
  }
}

@Injectable()
export class TopBarModule extends BrowserModule {
  providers = [TopBarContribution];

  // 关键: 声明 contributionProvider, DI 容器才会 createContributionProvider 并自动
  // 收集 @Domain(ComponentContribution) 标记的贡献者, 调用其 registerComponent(registry)
  contributionProvider = ComponentContribution;
}
