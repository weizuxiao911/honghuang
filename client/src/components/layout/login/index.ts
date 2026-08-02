import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { LoginView } from './LoginView';
import { LoginCommandsContribution } from './commands';

/**
 * login 槽位实现 — 与 topbar/rightbar/bottombar 同级, 走 OpenSumi 标准槽位机制
 *
 * 与官方 @opensumi/ide-menu-bar 同一机制:
 *   - LoginContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('login-default', { id, component: LoginView })
 *   - LoginModule (BrowserModule + contributionProvider = ComponentContribution)
 *     通过 appConfig.modules: [LoginModule] 注入 DI
 *   - slots.ts 的 layoutConfig['login'].modules = ['login-default']
 *   - LayoutComponent 用 <SlotRenderer slot="login"> 渲染本槽位 (与 left/right/bottom/top 完全一致)
 *
 * 槽位语义: client 仅提供默认实现 (GitHub OAuth mock, LoginView),
 * 自定义 VSIX 通过 VS Code 标准 contributes.views + viewsContainers
 * 注册自定义 view container (type='login' 由 client 框架按 VS Code 标准暴露)
 * 替换默认 LoginView, 加载 vsix 自带的 webview 渲染登录 UI (铁律 12).
 *
 * LoginView 自管 fixed full-screen overlay (position: fixed; inset: 0; z-index: 9999)
 * 与显隐控制 (taichu:login-show/hide/session-changed 三个事件),
 * 不再需要独立的 LoginLayout wrapper.
 *
 * 旧路径 (向后兼容): 通过 window event 'taichu:login-custom-view' 或
 * window.__TAICHU_LOGIN_API__.setCustomView(component) 接管本 view.
 *
 * 登录状态读写 (注册在 LoginCommandsModule):
 *   - taichu.login.session.get / set / clear
 *   - window.__TAICHU_LOGIN_API__ (在 LoginView 首次 mount 时安装)
 */
@Injectable()
@Domain(ComponentContribution)
export class LoginContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('login-default', {
      id: 'login-default',
      component: LoginView,
    });
  }
}

@Injectable()
export class LoginModule extends BrowserModule {
  providers = [LoginContribution];

  contributionProvider = ComponentContribution;
}

@Injectable()
export class LoginCommandsModule extends BrowserModule {
  providers = [LoginCommandsContribution];

  contributionProvider = CommandContribution;
}