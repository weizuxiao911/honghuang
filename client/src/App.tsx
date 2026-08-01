import React from 'react';

import { AppRenderer } from '@codeblitzjs/ide-core';
import '@codeblitzjs/ide-core/bundle/codeblitz.css';
import '@codeblitzjs/ide-core/languages';

import { appConfig, runtimeConfig } from './config/codeblitz.config';
import './styles/overrides.css';

/**
 * client 入口 — 只渲染 CodeBlitz AppRenderer,不写任何 bootstrap / runtime / VSIX 编排。
 * 框架默认的 welcome page 在 editor 空态出现;具体业务能力由 VSIX 自身按
 * `contributes.views` / `sumiContributes.browserViews.{slot}` 等标准机制注册。
 */
export const App: React.FC = () => {
  return <AppRenderer appConfig={appConfig} runtimeConfig={runtimeConfig as any} />;
};