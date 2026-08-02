import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from '../components/layout/layout';

/**
 * 槽位与布局配置 — CodeBlitz 容器怎么排版
 *
 * 框架级 layout 槽位 (panel slots, 是 layout 的容器, 装载独立拓展):
 *
 *   - SlotLocation.top:        顶部 chrome 区 (装载 menu-bar / tab-bar / settings 等)
 *   - SlotLocation.leftBar:    左侧栏 (VS Code Primary Side Bar, 装载 explorer / search / source-control)
 *   - SlotLocation.rightBar:   右侧栏 (VS Code Secondary Side Bar / Auxiliary Bar, 装载 AI 助手 / chat)
 *   - SlotLocation.bottomBar:  底部栏 (VS Code Panel, 装载 problems / terminal / output)
 *   - SlotLocation.statusBar:  状态栏 (装载 git / language / encoding)
 *   - SlotLocation.main:       中央编辑区 (装载 editor)
 *   - SlotLocation.login:      登录槽位 (client 内置, 装载默认 GitHub OAuth, 可被 VSIX 替换)
 *
 * 槽位装载的 module 由 BrowserModule 拓展提供, 按 VS Code 兼容拓展标准或
 * OpenSumi 兼容拓展标准开发, 与 client 解耦.
 */
export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  workspaceDir: '/',
  layoutComponent: LayoutComponent,
  layoutConfig: {
    [SlotLocation.top]: {
      modules: [
        'tc-topbar'
      ],
    },
    [SlotLocation.action]: {
      modules: [
      ]
    },
    [SlotLocation.leftBar]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
      ],
    },
    [SlotLocation.rightBar]: {
      modules: [
        'rightbar-default'
      ]
    },
    [SlotLocation.main]: {
      modules: [
        '@opensumi/ide-editor'
      ]
    },
    [SlotLocation.bottomBar]: {
      modules: [
        'tc-problems'
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
    // login 槽位 — client 内置默认, 可被 VSIX 替换
    login: {
      modules: [
        'login-default'
      ],
    },
  } as any,
};
