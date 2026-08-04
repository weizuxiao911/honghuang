import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { installRegistryMetadata } from './commands/registry';
import { readSession } from './commands/login/api';
import { installRuntimeAutoActivate, installSandboxClient, isRuntimeReady } from './commands/sandbox';
import { installFsApi, bindFsSync } from './commands/sandbox/fs';

// VSIX 兼容层: 业务 VSIX (如 taichu-landing-page) 通过 window.React 共享
// host 的 React 实例 (OpenSumi/CodeBlitz 扩展宿主约定), 不暴露会导致
// VSIX 组件里 useEffect 等为 undefined 崩溃
(window as any).React = React;

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container #root not found');
}

/**
 * 访问判断登录状态 (顶层守卫):
 *   - 未登录 → 不装沙箱模块, App 渲染编辑器骨架 + login overlay (当前页, 不跳登录页)
 *   - 已登录 → 装沙箱模块 (runtime 激活 / SDK / fs API / 同步),
 *              后续 App 内 LoadingView 监听 fs-list-ready 控制 loading 关闭
 */
function isLoggedIn(): boolean {
  return !!readSession()?.userId;
}

if (isLoggedIn()) {
  // 沙箱模块挂载必须在 App 渲染前 (BrowserModule.onDidStart 钩子时序不可靠)
  installRuntimeAutoActivate();
  installSandboxClient();
  installFsApi();
  bindFsSync();
}

// 启动期拉取 registry 业务 VSIX 元数据 → 填充 runtimeConfig.extensionMetadata
// (CodeBlitz 动态安装 VSIX: paper / chat-window / landing-page 等)
void installRegistryMetadata().finally(() => {
  ReactDOM.createRoot(container).render(<App />);
});

// 占位导出避免 unused import 警告 (isRuntimeReady 供其他模块查 runtime 状态)
export { isRuntimeReady };
