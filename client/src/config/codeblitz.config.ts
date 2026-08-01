import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { BrowserFSFileType as FileType } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { LayoutComponent } from './layout';

/**
 * client appConfig — CodeBlitz 容器配置。
 *
 * 设计定位:
 *   - client 是 OpenSumi/CodeBlitz 框架容器,不写业务逻辑、不主动装载 VSIX
 *   - layoutConfig 列出 8 个常用 slot 与对应 builtin module(框架自带);具体业务视图由 VSIX 自己注册
 *   - defaultPanels 给出 panel 默认布局;具体视图交给框架 + VSIX
 */
export const appConfig: IAppRendererProps['appConfig'] = {
  workspaceDir: 'workspace',
  layoutComponent: LayoutComponent as any,
  layoutConfig: {
    [SlotLocation.top]: { modules: [] },
    [SlotLocation.action]: { modules: [] },
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
        '@opensumi/ide-scm',
        '@opensumi/ide-debug',
      ],
    },
    [SlotLocation.right]: { modules: [] },
    [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
    [SlotLocation.bottom]: { modules: ['@opensumi/ide-output', '@opensumi/ide-markers'] },
    [SlotLocation.statusBar]: { modules: ['@opensumi/ide-status-bar'] },
    [SlotLocation.extra]: { modules: [] },
  } as any,
  defaultPreferences: {
    'general.theme': 'opensumi-design-dark-theme',
    'editor.autoSave': 'afterDelay',
    'editor.autoSaveDelay': 1000,
    'workbench.startupEditor': 'none',
    'breadcrumbs.enabled': false,
  },
  defaultPanels: {
    left: '@opensumi/ide-explorer',
    bottom: '',
    right: '',
  },
} as any;

/**
 * runtimeConfig — CodeBlitz 运行时配置。
 *
 * client 不接管任何文件系统客户端、不注入任何 window 全局;
 * filesystem 配置留空,让 CodeBlitz 走默认 in-memory / IndexedDB 实现。
 * 业务 IO 由 VSIX 通过窗口外工具(自己的 fetch / agent-image 直连)实现。
 */
export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  workspace: {
    filesystem: {
      fs: 'OverlayFS',
      options: {
        writable: { fs: 'IndexedDB' },
        readable: { fs: 'DynamicRequest' },
      },
    },
  },
} as any;