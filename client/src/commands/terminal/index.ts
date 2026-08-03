import { Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';
import { ITerminalServicePath } from '@opensumi/ide-terminal-next/lib/common';

import { OpenCodePtyService, TerminalSetupContribution } from './OpenCodePtyService';

/**
 * 终端模块 — 接入 OpenSumi 终端 (TerminalNext), 把 node pty 层替换为 OpenCode /pty
 *
 * 职责:
 *   - OpenCodePtyService: ITerminalServicePath 的 browser 实现 (映射 OpenCode /pty)
 *   - TerminalSetupContribution: 启动时兜底覆盖 (若 RPC stub 已注册)
 *
 * 关键: ITerminalServicePath 必须与 OpenCodePtyService 共享同一实例
 * (useFactory 返回 OpenCodePtyService 实例), 否则 create2 和 onMessage
 * 可能走不同实例导致 dispatcher key 不匹配.
 *
 * TerminalNextModule (OpenSumi 终端 UI) 由 App.tsx 注册.
 */
@Injectable()
export class TerminalModule extends BrowserModule {
  providers = [
    OpenCodePtyService,
    TerminalSetupContribution,
    {
      token: ITerminalServicePath,
      useFactory: (injector: any) => injector.get(OpenCodePtyService),
    },
  ];
}
