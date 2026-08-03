import { Injectable } from '@opensumi/di';
import { Domain } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ComponentContribution, ComponentRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { UserView } from './webview/UserView';

/**
 * userPage 槽位实现 — 与 login 槽位平行, 走 OpenSumi 标准槽位机制
 *
 * LayoutComponent 用 <SlotRenderer slot="userPage"> 渲染本槽位;
 * slots.ts 的 layoutConfig['userPage'].modules = ['user-default']
 *
 * 槽位语义: client 仅提供默认实现 (UserView 用户信息卡片, 含 logout 按钮),
 * 自定义 VSIX 通过 VS Code 标准 contributes.views + viewsContainers
 * 注册自定义 view container (type='userPage' 由 client 框架按 VS Code 标准暴露)
 * 替换默认 UserView, 加载 vsix 自带 webview 渲染真实用户信息 UI (铁律 12).
 *
 * 触发 entry (TopBar 账号按钮):
 *   - window.dispatchEvent(new CustomEvent('taichu:user-show')) → 显示弹窗
 *   - window.dispatchEvent(new CustomEvent('taichu:user-hide')) → 隐藏
 *   - 点击 popover 外 / 按 Esc  → 自动隐藏 (UserView 内部处理)
 */
@Injectable()
@Domain(ComponentContribution)
export class UserContribution implements ComponentContribution {
  registerComponent(registry: ComponentRegistry): void {
    registry.register('user-default', {
      id: 'user-default',
      component: UserView,
    });
  }
}

@Injectable()
export class UserModule extends BrowserModule {
  providers = [UserContribution];

  contributionProvider = ComponentContribution;
}