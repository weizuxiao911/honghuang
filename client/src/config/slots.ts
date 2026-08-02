import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from '../components/layout/layout';

/**
 * 槽位与布局配置 — CodeBlitz 容器怎么排版
 *
 * 框架级 layout 槽位 (panel slots, 是 layout 的容器, 装载独立拓展):
 * 注意: 必须使用标准 slot id (left / right / bottom),
 * OpenSumi 只为这三个 id 注册了面板渲染器 (含 tabbar 切换 / 折叠 / 拖拽 resize);
 * leftBar / rightBar / bottomBar 是框架 @deprecated 字面量别名, 无渲染器,
 * 用它们会导致槽位回落 DefaultRenderer, 面板失去折叠/展开能力.
 *
 *   - SlotLocation.top:       顶部 chrome 区 (装载 menu-bar / tab-bar / settings 等)
 *   - SlotLocation.left:      左侧栏 (VS Code Primary Side Bar, 装载 explorer / search / source-control)
 *   - SlotLocation.right:     右侧栏 (VS Code Secondary Side Bar / Auxiliary Bar, 装载 AI 助手 / chat)
 *   - SlotLocation.bottom:    底部栏 (VS Code Panel, 装载 problems / terminal / output)
 *   - SlotLocation.main:      中央编辑区 (装载 editor)
 *   - login:                  登录槽位 (full-screen overlay, client 内置 LoginView, 可被 VSIX 替换)
 *   - userPage:               用户信息槽位 (TopBar 下方右对齐浮动弹窗, client 内置 UserView 含 logout, 可被 VSIX 替换)
 *
 * 客户端不使用 statusBar slot (无状态栏); 右侧 right slot 渲染器被
 * rightbar/RightPanelRenderer 覆盖 (面板 + 顶部 tab 横条, 无竖 icon 栏).
 *
 * 槽位装载的 module 由 BrowserModule 拓展提供, 按 VS Code 兼容拓展标准或
 * OpenSumi 兼容拓展标准开发, 与 client 解耦.
 */
export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  // IDE workspace 根: 沙箱文件 IO 走 @opencode-ai/sdk (commands/opencode),
  // 不再自定义 OpenSumi FileSystemProvider; workspaceDir 走 CodeBlitz 默认
  workspaceDir: '/workspace',
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
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
      ],
    },
    [SlotLocation.right]: {
      modules: [
        'rightbar-default'
      ]
    },
    [SlotLocation.main]: {
      modules: [
        '@opensumi/ide-editor'
      ]
    },
    [SlotLocation.bottom]: {
      modules: [
        'tc-problems'
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
    // userPage 槽位 — TopBar 账号按钮触发, 浮动弹窗, 可被 VSIX 替换
    userPage: {
      modules: [
        'user-default'
      ],
    },
  } as any,
};
