import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { ComponentRegistry } from '@opensumi/ide-core-browser';

import { TopBar } from './components/TopBar';
import { slots } from './config/slots';
import { preferences } from './config/preferences';
import { runtimeConfig } from './config/runtime';
import './styles/overrides.css';

/**
 * client 入口 — 只渲染 CodeBlitz AppRenderer, 不写业务逻辑。
 *
 * onLoad 里做一件事: 把框架级 chrome TopBar 注册成 top slot 模块
 * (ComponentRegistry.register('tc-topbar', ...)), slots.ts 的 layoutConfig[top].modules
 * 已声明 'tc-topbar'; layout.tsx 用 SlotRenderer slot='top' 渲染。
 *
 * 具体业务能力由 VSIX 自身按 contributes.views / sumiContributes.browserViews.{slot}
 * 等标准机制注册, client 不编排任何 VSIX。
 */
export const App: React.FC = () => {
  return (
    <AppRenderer
      appConfig={{
        ...slots,
        defaultPreferences: preferences,
      }}
      runtimeConfig={runtimeConfig as any}
      onLoad={(app) => {
        try {
          const injector: any = (app as any).injector;
          const componentRegistry: any = injector.get(ComponentRegistry);
          componentRegistry.register('tc-topbar', {
            id: 'tc-topbar',
            title: 'TopBar',
            component: TopBar,
          });
        } catch (error) {
          console.warn('[Taichu] 注册 TopBar 到 top slot 失败', error);
        }
      }}
    />
  );
};
