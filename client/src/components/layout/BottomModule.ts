import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { ProblemsView } from './ProblemsView';
import { BottomPlaceholder } from './BottomPlaceholder';

/**
 * bottom slot Module — 跟 TopBarModule 同一机制
 *
 * 注册 2 个 views:
 *   - 'tc-problems': 真实 "问题" 面板 (VS Code 风格)
 *   - 'tc-bottom-placeholder': 兜底占位
 *
 * 让 layoutConfig[bottom].modules 有 module 可注册,
 * 触发 layoutService.toggleSlot(bottom) 时能正确切换 isVisible 状态.
 */
@Injectable()
@Domain(ComponentContribution)
export class BottomContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('tc-problems', {
      id: 'tc-problems',
      component: ProblemsView,
    });
    registry.register('tc-bottom-placeholder', {
      id: 'tc-bottom-placeholder',
      component: BottomPlaceholder,
    });
  }
}

@Injectable()
export class BottomModule extends BrowserModule {
  providers = [BottomContribution];

  contributionProvider = ComponentContribution;
}
