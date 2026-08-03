import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { LoadingView } from './LoadingView';

/**
 * Loading 拓展 — loading 槽位 (extensions/loading/)
 *
 * OpenSumi 拓展标准:
 *   - LoadingContribution @Domain(ComponentContribution), registerComponent
 *     registry.register('loading-default', { component: LoadingView })
 *   - LoadingModule (BrowserModule + contributionProvider = ComponentContribution)
 *   - slots.ts 的 layoutConfig['loading'].modules = ['loading-default']
 *   - layout.tsx 用 <SlotRenderer slot="loading"> 渲染
 *
 * 内容: 沙箱启动 loading overlay (登录后 → opencode 探活通过前)
 */
@Injectable()
@Domain(ComponentContribution)
export class LoadingContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('loading-default', {
      id: 'loading-default',
      component: LoadingView,
    });
  }
}

@Injectable()
export class LoadingModule extends BrowserModule {
  providers = [LoadingContribution];

  contributionProvider = ComponentContribution;
}
