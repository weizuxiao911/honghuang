import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from './layout';

export const slots: Pick<IAppRendererProps['appConfig'], 'workspaceDir' | 'layoutComponent' | 'layoutConfig' | 'defaultPanels'> = {
  workspaceDir: '/workspace',
  layoutComponent: LayoutComponent,
  layoutConfig: {
    [SlotLocation.top]: {
      modules: [
        'actions-default',
      ],
    },
    [SlotLocation.action]: {
      modules: [
      ]
    },
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
      ],
    },
    [SlotLocation.right]: {
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
        '@opensumi/ide-terminal-next',
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
    // user 槽位 — 账号按钮触发, 浮动弹窗, 可被 VSIX 替换
    user: {
      modules: [
        'user-default'
      ],
    },
    // loading 槽位 — 沙箱启动 loading overlay (登录后 → opencode 探活通过前)
    loading: {
      modules: [
        'loading-default'
      ],
    },
    // toast 槽位 — 全局轻提示 (登录门禁等)
    toast: {
      modules: [
        'toast-default'
      ],
    },
  } as any,
};
