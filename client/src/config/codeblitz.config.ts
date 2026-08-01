import type { IAppRendererProps } from '@codeblitzjs/ide-core';

import { preferences } from './preferences';
import { runtimeConfig } from './runtime';
import { slots } from './slots';

import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { BrowserFSFileType as FileType } from '@codeblitzjs/ide-core';

import { LandingChrome } from '../components/LandingChrome';
import { preferences } from './preferences';
import { runtimeConfig } from './runtime';
import { slots } from './slots';

/**
 * appConfig — CodeBlitz 容器入口配置
 *
 * 由三个独立模块组装而成:
 *   - slots:        槽位 / 布局 / 默认 panel
 *   - preferences:  defaultPreferences
 *   - runtimeConfig: 在 App.tsx 里单独传给 AppRenderer
 *
 * client 是 OpenSumi/CodeBlitz 框架容器, 不写业务逻辑、不主动装载 VSIX;
 * LandingChrome 是 client 框架默认空态 chrome(布局与 spacing 严格受控),
 * 业务 landing 内容(实际数据 / 点击行为)由 VSIX 通过 contributes.views 注入。
 */
export const appConfig: IAppRendererProps['appConfig'] = {
  ...slots,
  defaultPreferences: preferences,
  runtimeConfig: {
    workspace: {
      filesystem: {
        fs: 'OverlayFS',
        options: {
          writable: { fs: 'IndexedDB' },
          readable: { fs: 'DynamicRequest' },
        },
      },
    },
  },
  // CodeBlitz 在编辑器空态时挂这个组件(自身机制, 不依赖 'workbench.startupEditor' 字段)
  WelcomePage: LandingChrome as any,
};

export { runtimeConfig };

