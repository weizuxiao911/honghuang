import type { IAppRendererProps } from '@codeblitzjs/ide-core';

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
 * client 是 OpenSumi/CodeBlitz 框架容器,不写业务逻辑、不主动装载 VSIX;
 * 具体业务视图由 VSIX 按 contributes.views 标准字段注册。
 */
export const appConfig: IAppRendererProps['appConfig'] = {
  ...slots,
  defaultPreferences: preferences,
};

export { runtimeConfig };
