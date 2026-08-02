import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';


import { slots } from './config/slots';
import { TopBarModule } from './components/layout/topbar';
import { LoginModule, LoginCommandsModule } from './components/layout/login';
import { RightBarModule, BottomModule } from './components/layout';
import { preferences } from './config/preferences';
import { runtimeConfig } from './config/runtime';
import './styles/overrides.css';

/**
 * 框架级 chrome 注册 — 把 TopBar + Login(两个 Module) 注册进 DI
 *
 * 与官方 @opensumi/ide-menu-bar 同一机制:
 *   - TopBarModule / LoginModule / LoginCommandsModule 是 BrowserModule,
 *     providers 里注册 Contribution
 *   - Contribution @Domain(ComponentContribution / CommandContribution),
 *     registerComponent / registerCommands 调用
 *   - slots.ts 的 layoutConfig[].modules = ['tc-topbar', 'login-default']
 *   - layout.tsx 的 LayoutComponent 检测登录状态, 未登录时渲染 LoginLayout
 *
 * 业务能力由 VSIX 通过 contributes.views 等标准机制注册, client 不编排 VSIX。
 */


export const App: React.FC = () => {
  return (
    <AppRenderer
      appConfig={{
        ...slots,
        defaultPreferences: preferences,
        // 注入内置拓展 Module: topBar chrome + login 槽位 + login commands + bottombar (tc-problems) + rightbar 容器
        modules: [TopBarModule, LoginModule, LoginCommandsModule, BottomModule, RightBarModule],
      }}
      runtimeConfig={runtimeConfig as any}
    />
  );
};
