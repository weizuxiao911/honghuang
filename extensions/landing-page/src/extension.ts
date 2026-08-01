import * as vscode from 'vscode';

const React = (window as any).React;

const log = (...args: unknown[]) =>
  console.log('>>>[landing-page][extension]', ...args);

/**
 * Taichu 着陆页扩展 - server/worker 侧 stub
 *
 * 职责:
 *   1. 注册 5 颗动作按钮的全局 command, 由 app / 后续 VSIX 接走
 *   2. 把 React 渲染入口注册到 window.__TAICHU_LANDING__,
 *      并通知 app/src/components/WelcomePage.tsx 薄壳重新挂载
 *
 * 设计文档边界:
 *   - 本扩展不直接做文件 IO、不直连 Agent API
 *   - File 客户端 / Agent baseUrl 完全由 app 注入 (__TAICHU_RUNTIME__)
 *   - 所有用户动作派发为全局 command, 由 app 或激活的 VSIX 接走
 */

// 把视图层的 React 组件拎到这里, 通过 lazy require 拿到 views 暴露的 LandingPage
// 实际渲染发生在 framework 的 WelcomePage 树中, 不是在 VSIX 自己的视图树。
// 这样可以避免 main slot 同时存在两个内容源。
function getLandingComponent(): React.ComponentType<unknown> | null {
  // views.js 由 OpenSumi 在 activate 后异步加载, 其内部 React 解构 + window 注册
  // 都已包了轮询; 这里直接读全局即可, 不再 require('../out/views.js') 避免
  // 早期 React 未就绪时触发 destructure 报错。
  const Comp = (window as any).__TAICHU_LANDING_COMPONENT__;
  if (Comp) return Comp;
  return (window as any).__tcLandingFactory ?? null;
}

export function activate(context: vscode.ExtensionContext) {
  log('activate');

  const dispatch = (key: string) =>
    vscode.commands.registerCommand(`taichu.landing.${key}`, () => {
      window.dispatchEvent(
        new CustomEvent('taichu:landing-action', { detail: { key } }),
      );
      void vscode.commands
        .executeCommand(`taichu.workbench.${key}`)
        .catch(() => {
          /* 没人接就静默 */
        });
    });

  context.subscriptions.push(
    dispatch('openFolder'),
    dispatch('newProject'),
    dispatch('cloneGit'),
    dispatch('remoteHost'),
    dispatch('newFile'),
  );

  // views.js 由 OpenSumi 单独加载, 可能晚于 extension.ts 同一帧 ready;
// 等 views 自己派发的 'taichu:landing-component-ready' 事件, 设上限 12 秒兜底
let attempts = 0;
const timer = setInterval(() => {
  attempts++;
  const Comp = getLandingComponent();
  if (Comp) {
    clearInterval(timer);
    (window as any).__TAICHU_LANDING__ = Comp;
    window.dispatchEvent(new CustomEvent('taichu:landing-registered'));
    log(`registered __TAICHU_LANDING__ after ${attempts} polls`);
  } else if (attempts >= 240) {
    clearInterval(timer);
    log('gave up after 240 polls; no __TAICHU_LANDING_COMPONENT__');
  }
}, 50);
}

export function deactivate() {
  (window as any).__TAICHU_LANDING__ = null;
  log('deactivate');
}
