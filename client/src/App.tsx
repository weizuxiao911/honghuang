import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';


import { TopBarModule, slots } from './config/slots';
import { preferences } from './config/preferences';
import { runtimeConfig } from './config/runtime';
import './styles/overrides.css';

/**
 * 框架级 chrome 注册 — 把 TopBar 注册进 SlotLocation.top
 *
 * 与官方 @opensumi/ide-menu-bar 同一机制:
 *   - TopBarModule 是 BrowserModule, providers 里注册 TopBarContribution
 *   - TopBarContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('tc-topbar', { id, component })
 *   - slots.ts 的 layoutConfig[SlotLocation.top].modules = ['tc-topbar']
 *   - layout.tsx 的 SlotRenderer slot='top' 渲染
 *
 * 业务能力由 VSIX 通过 contributes.views 等标准机制注册, client 不编排 VSIX。
 */


export const App: React.FC = () => {
  return (
    <AppRenderer
      appConfig={{
        ...slots,
        defaultPreferences: preferences,
        // TopBarModule 提供 TopBarContribution (注册 tc-topbar 组件到 top slot)
        modules: [TopBarModule],
      }}
      runtimeConfig={runtimeConfig as any}
    />
  );
};
