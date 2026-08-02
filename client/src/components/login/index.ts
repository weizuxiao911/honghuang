import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { LoginView } from './LoginView';
import { LoginCommandsContribution } from './commands';

/**
 * login 槽位实现 — client 内置默认登录交互
 *
 * 与 topbar 同一机制:
 *   - LoginContribution @Domain(ComponentContribution), registerComponent 里
 *     registry.register('login-default', { id, component: LoginView })
 *   - LoginModule (BrowserModule + contributionProvider = ComponentContribution)
 *     通过 appConfig.modules: [LoginModule] 注入 DI
 *   - slots.ts 的 layoutConfig['login'].modules = ['login-default']
 *   - LayoutComponent 检测未登录时, 渲染 LoginLayout (SlotRenderer slot='login')
 *
 * 槽位语义: client 仅提供默认示例 (GitHub OAuth)，自定义 VSIX 通过
 * contributes.views + viewsContainers 注册自定义 view container 替换默认
 * (login type 由框架按 VS Code 标准暴露，铁律 12)。
 *
 * LoginView 内部监听 'taichu:login-custom-view' window 事件,
 * VSIX 派发该事件后, 包一层 <CustomComponent /> 替换默认 login view。
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
