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
  // views.js 里通过 `exports['taichuLanding'] = LandingPage;` 挂出来
  // CodeBlitz 加载 VSIX 后会把 browserMain 的 module exports 暴露到 vscode-extension 加载器
  try {
    // 触发 views 模块求值 (若尚未加载)
    void require('../out/views.js');
  } catch (err) {
    log('require views.js failed:', err);
  }
  // OpenSumi vscode API 暴露的 extension.exports 在宿主之间不通用;
  // 直接走 window 全局兜底 - chrome 浏览器单实例 + 同源 window, 安全。
  const Comp = (window as any).__TAICHU_LANDING_COMPONENT__;
  if (Comp) return Comp;
  // 兜底: views 里直接挂了一个 __tcLandingFactory 全局, 在 views.js 末尾被定义。
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

  // 等一帧让 views.js 把全局注册完成
  setTimeout(() => {
    const Comp = getLandingComponent();
    if (Comp) {
      (window as any).__TAICHU_LANDING__ = Comp;
      window.dispatchEvent(new CustomEvent('taichu:landing-registered'));
      log('registered __TAICHU_LANDING__');
    } else {
      log('no __tcLandingFactory found on window');
    }
  }, 0);
}

export function deactivate() {
  (window as any).__TAICHU_LANDING__ = null;
  log('deactivate');
}
