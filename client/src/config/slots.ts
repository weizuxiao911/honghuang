import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

/**
 * 槽位与布局配置 — CodeBlitz 容器怎么排版
 *
 * - workspaceDir: IDE 工作区目录名(框架默认)
 * - layoutComponent: 自定义顶层布局(用框架默认 BoxPanel + SplitPanel 装配)
 * - layoutConfig: 8 个常用 slot 与对应 builtin module;具体业务视图由 VSIX 自己注册
 * - defaultPanels: 启动时各方向默认激活的 panel id
 *
 * 说明: tc-topbar 组件由 client/src/components/topbar/index.ts 的 TopBarModule 注册,
 * 这里只声明模块 id ('tc-topbar') 挂到 SlotLocation.top。
 */
export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  workspaceDir: '/',
  layoutConfig: {
    // tc-topbar 由 client/src/components/topbar/index.ts 的 TopBarModule 注册,
    // 这里用模块 id 挂到 top slot (与官方 @opensumi/ide-menu-bar 同一机制)
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
