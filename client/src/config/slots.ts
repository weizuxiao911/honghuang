import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from '../components/layout/layout';

/**
 * 槽位与布局配置 — CodeBlitz 容器怎么排版
 *
 * - workspaceDir: IDE 工作区目录名(框架默认)
 * - layoutComponent: 自定义顶层布局(检测登录状态, 未登录时渲染 LoginLayout)
 * - layoutConfig: 8 个常用 slot + login slot 与对应 builtin module;具体业务视图由 VSIX 自己注册
 * - defaultPanels: 启动时各方向默认激活的 panel id
 *
 * 说明:
 *   - tc-topbar    由 client/src/components/topbar/ 的 TopBarModule 注册, 在 top slot
 *   - login-default 由 client/src/components/login/ 的 LoginModule 注册, 在 login slot
 *   - login slot 由 client 框架按 VS Code 标准 view container 暴露 (铁律 12),
 *     自定义 VSIX 通过 contributes.views + viewsContainers 注册自定义 view 替换默认
 */
export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  workspaceDir: '/',
  layoutComponent: LayoutComponent,
  layoutConfig: {
    // tc-topbar 由 client/src/components/topbar/index.ts 的 TopBarModule 注册
    [SlotLocation.top]: {
      modules: [
        'tc-topbar'
      ],
    },
    [SlotLocation.action]: {
      modules: [
      ]
    },
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
      ],
    },
    [SlotLocation.rightBar]: {
      modules: [
        'ai-panel-default'
      ]
    },
    [SlotLocation.main]: {
      modules: [
        '@opensumi/ide-editor'
      ]
    },
    [SlotLocation.bottom]: {
      modules: [
        'tc-bottom-placeholder'
      ]
    },
    [SlotLocation.statusBar]: {
      modules: [
        '@opensumi/ide-status-bar'
      ]
    },
    [SlotLocation.extra]: {
      modules: [
      ]
    },
    [SlotLocation.bottom]: {
      modules: [
        'tc-problems'
      ]
    },
    // login slot — client 内置默认实现, 可被 VSIX 替换
    login: {
      modules: [
        'login-default'
      ],
    },
  } as any,
  // defaultPanels: {
  //   left: '@opensumi/ide-explorer',
  //   bottom: '',
  //   right: '',
  // },
};
