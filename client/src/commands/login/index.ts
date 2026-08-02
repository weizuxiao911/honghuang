import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { readSession, writeSession, clearSession } from './api';
import type { LoginSession } from './api';

/**
 * login commands — 暴露登录状态读写给 VSIX 或其他 client 拓展
 *
 * 命名约定:
 *   taichu.login.session.get    → 读当前登录 session
 *   taichu.login.session.set    → 写登录 session (Mock 登录)
 *   taichu.login.session.clear  → 清登录 session (登出)
 *
 * 与 window.__TAICHU_LOGIN_API__ 是同一份实现的两条访问路径:
 *   - commands: 走 OpenSumi CommandService (CommandRegistry)
 *   - window API: 直接调用, 简单场景
 *
 * Module: LoginCommandsModule (BrowserModule + contributionProvider = CommandContribution),
 * 通过 appConfig.modules: [LoginCommandsModule] 注入 DI 即可使用.
 */

export const LOGIN_SESSION_GET = 'taichu.login.session.get';
export const LOGIN_SESSION_SET = 'taichu.login.session.set';
export const LOGIN_SESSION_CLEAR = 'taichu.login.session.clear';

@Injectable()
@Domain(CommandContribution)
export class LoginCommandsContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: LOGIN_SESSION_GET },
      {
        execute: () => readSession(),
      }
    );
    commands.registerCommand(
      { id: LOGIN_SESSION_SET },
      {
        execute: (session: LoginSession) => {
          writeSession(session);
          return true;
        },
      }
    );
    commands.registerCommand(
      { id: LOGIN_SESSION_CLEAR },
      {
        execute: () => {
          clearSession();
          return true;
        },
      }
    );
  }
}

/**
 * LoginCommandsModule — BrowserModule + CommandContribution,
 * 通过 appConfig.modules: [LoginCommandsModule] 注入 DI 即可使用 commands.
 */
@Injectable()
export class LoginCommandsModule extends BrowserModule {
  providers = [LoginCommandsContribution];

  contributionProvider = CommandContribution;
}