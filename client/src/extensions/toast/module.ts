import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { ToastView } from './ToastView';

/**
 * Toast 拓展 — toast 槽位 (extensions/toast/)
 *
 * OpenSumi 拓展标准:
 *   - ToastContribution @Domain(ComponentContribution), registerComponent
 *     registry.register('toast-default', { component: ToastView })
 *   - ToastModule (BrowserModule + contributionProvider = ComponentContribution)
 *   - slots.ts 的 layoutConfig['toast'].modules = ['toast-default']
 *   - layout.tsx 用 <SlotRenderer slot="toast"> 渲染
 *
 * 内容: 全局轻提示 (登录门禁等场景, 监听 taichu:gate-hint)
 */
@Injectable()
@Domain(ComponentContribution)
export class ToastContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('toast-default', {
      id: 'toast-default',
      component: ToastView,
    });
  }
}

@Injectable()
export class ToastModule extends BrowserModule {
  providers = [ToastContribution];

  contributionProvider = ComponentContribution;
}
