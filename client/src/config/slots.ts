import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from './layout';

import { Injectable, Injector } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { TopBar } from '../components/TopBar';

@Injectable()
@Domain(ComponentContribution)
class TopBarContribution implements ComponentContribution {
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

/**
 * 槽位与布局配置 — CodeBlitz 容器怎么排版
 *
 * - workspaceDir: IDE 工作区目录名(框架默认)
 * - layoutComponent: 自定义顶层布局(用框架默认 BoxPanel + SplitPanel 装配)
 * - layoutConfig: 8 个常用 slot 与对应 builtin module;具体业务视图由 VSIX 自己注册
 * - defaultPanels: 启动时各方向默认激活的 panel id
 */
export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  workspaceDir: 'workspace',
  layoutComponent: LayoutComponent as any,
  layoutConfig: {
    // tc-topbar 由 App.tsx onLoad 里 ComponentRegistry.register('tc-topbar', ...) 注册,
    // 框架 chrome 走 slot 机制(与官方 @opensumi/ide-menu-bar 同一方式), 不硬编码在 LayoutComponent
    [SlotLocation.top]: {
      modules: ['tc-topbar'],
    },
    [SlotLocation.action]: { modules: [] },
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
      ],
    },
    [SlotLocation.right]: { modules: [] },
    [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
    [SlotLocation.bottom]: { modules: [] },
    [SlotLocation.statusBar]: { modules: ['@opensumi/ide-status-bar'] },
    [SlotLocation.extra]: { modules: [] },
  } as any,
  defaultPanels: {
    left: '@opensumi/ide-explorer',
    bottom: '',
    right: '',
  },
};
