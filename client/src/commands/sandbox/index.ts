import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';

import { getOpencodeClient, isOpencodeReady, installOpencodeClient, disposeOpencodeClient } from './client';
import { installRuntimeAutoActivate, activateRuntime, teardownRuntime, isRuntimeReady, getRuntime } from './runtime';

/**
 * opencode commands — 沙箱接入单一入口
 *
 * 客户端连接沙箱的唯一通道: 通过 @opencode-ai/sdk 访问 (v1 协议).
 * 不直接 fetch HTTP 端点 (绕过 SDK 会丢失 Accept 头 / CORS / query 编码 /
 * WebSocket 升级等必要协议处理).
 *
 * VSIX 与 client 内部拓展 (commands/fs, future ai-panel) 全部通过
 *   window.__TAICHU_OPENCODE__ (OpencodeClient 实例) 访问沙箱:
 *
 *   const client = window.__TAICHU_OPENCODE__
 *   const { data: files } = await client.file.list({ query: { path: '/workspace' } })
 *   const { data: content } = await client.file.read({ query: { path: '/workspace/foo.txt' } })
 *   const { data: pty } = await client.pty.create({ body: { command: 'bash' } })
 *   const { data: session } = await client.session.create({ body: { title } })
 *   ...
 *
 * 命名约定 (用于 commands 总线, 大多数场景 VSIX 直接用 window.__TAICHU_OPENCODE__):
 *   taichu.opencode.isReady        ()            → boolean
 *   taichu.opencode.get            ()            → OpencodeClient | null
 *   taichu.opencode.runtime.activate ()           → RuntimeInfo | null   (手动激活, 一般自动)
 *   taichu.opencode.runtime.teardown ()           → void                   (手动卸载)
 *
 * Module: OpencodeCommandsModule (BrowserModule)
 *   - 注入 OpencodeCommandsContribution (注册 commands)
 *   - 注入 OpencodeClientAppContribution (onDidStart 装 runtime 拉取 + SDK 监听)
 *   - 自动被 App.tsx 的 appConfig.modules 引用
 */

export const OPENCODE_CMD = {
  IS_READY: 'taichu.opencode.isReady',
  GET: 'taichu.opencode.get',
  ACTIVATE: 'taichu.opencode.runtime.activate',
  TEARDOWN: 'taichu.opencode.runtime.teardown',
} as const;

@Injectable()
@Domain(CommandContribution)
export class OpencodeCommandsContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: OPENCODE_CMD.IS_READY },
      {
        execute: () => isOpencodeReady(),
      }
    );
    commands.registerCommand(
      { id: OPENCODE_CMD.GET },
      {
        execute: () => getOpencodeClient(),
      }
    );
    commands.registerCommand(
      { id: OPENCODE_CMD.ACTIVATE },
      {
        execute: () => activateRuntime(),
      }
    );
    commands.registerCommand(
      { id: OPENCODE_CMD.TEARDOWN },
      {
        execute: () => {
          teardownRuntime();
          disposeOpencodeClient();
        },
      }
    );
  }
}

/**
 * OpencodeClientAppContribution — onDidStart 装 runtime 拉取 + SDK 监听.
 * 独立于 CommandsContribution, 不会被 contributionProvider 自动收集, 直接 providers 数组实例化.
 */
@Injectable()
class OpencodeClientAppContribution implements ClientAppContribution {
  onDidStart(): void {
    installRuntimeAutoActivate();
    installOpencodeClient();
  }
}

@Injectable()
export class OpencodeCommandsModule extends BrowserModule {
  providers = [
    OpencodeCommandsContribution,
    OpencodeClientAppContribution,
  ];

  // 同时收集 CommandContribution (注册 commands) 和 ClientAppContribution (onDidStart 装 SDK)
  contributionProvider = [CommandContribution, ClientAppContribution];
}

// 重新导出供 commands/fs 引用 (getFsClient = getOpencodeClient 别名)
export {
  getOpencodeClient,
  isOpencodeReady,
  installOpencodeClient,
  disposeOpencodeClient,
} from './client';

export {
  installRuntimeAutoActivate,
  activateRuntime,
  teardownRuntime,
  isRuntimeReady,
  getRuntime,
} from './runtime';

export type { RuntimeInfo } from './runtime';