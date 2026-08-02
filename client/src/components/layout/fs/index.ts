/**
 * fs 槽位实现 — 登录后自动接入沙箱环境
 *
 * 模块组成:
 *   - FsContribution (@Domain(FsProviderContribution))
 *     框架启动时调用 registerProvider(scheme, provider), 把唯一的 sandbox provider
 *     实例注入 OpenSumi FileService. Provider 内部维护 active 状态:
 *       - active=false (未登录/未拿到 baseUrl): 所有操作抛错 "sandbox not active"
 *       - active=true  (登录后 fs-ready): 真实调用沙箱 HTTP API
 *
 *   - FsCommandsContribution (@Domain(CommandContribution))
 *     注册 taichu.fs.{list|read|write|create|delete|upload} 6 个 commands
 *
 *   - FsRuntimeContribution (@Domain(ClientAppContribution))
 *     onDidStart: 调用 installRuntimeAutoActivate() 监听登录态, 派发 fs-ready/fs-teardown
 *     同时 installFsApi() 装 window.__TAICHU_FS_API__
 *
 *   - FsActivationContribution (@Domain(ClientAppContribution))
 *     onDidStart: 监听 'taichu:fs-ready' / 'taichu:fs-teardown'
 *     ready → provider.setActive(true)
 *     teardown → provider.setActive(false)
 */

import { Injectable, Optional } from '@opensumi/di';
import { Domain, CommandContribution } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { FsProviderContribution } from '@opensumi/ide-core-browser/lib/fs';

import { FsCommandsContribution, installFsApi } from './commands';
import { newSandboxFileSystemProvider, SANDBOX_SCHEME } from './sandbox-fs';
import type { SandboxFileSystemProvider } from './sandbox-fs';
import { installRuntimeAutoActivate } from './runtime';

@Injectable()
@Domain(FsProviderContribution)
export class FsContribution implements FsProviderContribution {
  private provider: SandboxFileSystemProvider | null = null;

  registerProvider(registry: {
    registerProvider(scheme: string, provider: any): { dispose(): void };
  }): void {
    this.provider = newSandboxFileSystemProvider();
    registry.registerProvider(SANDBOX_SCHEME, this.provider);
  }

  setActive(active: boolean): void {
    this.provider?.setActive(active);
  }
}

@Injectable()
@Domain(ClientAppContribution)
export class FsRuntimeContribution implements ClientAppContribution {
  onDidStart(): void {
    installFsApi();
    installRuntimeAutoActivate();
  }
}

@Injectable()
@Domain(ClientAppContribution)
export class FsActivationContribution implements ClientAppContribution {
  constructor(
    @Optional() private readonly fsProviderContribution: FsContribution
  ) {}

  onDidStart(): void {
    const provider = this.fsProviderContribution;
    if (!provider) return;
    window.addEventListener('taichu:fs-ready', () => provider.setActive(true));
    window.addEventListener('taichu:fs-teardown', () => provider.setActive(false));
  }
}

@Injectable()
export class FsModule extends BrowserModule {
  providers = [
    FsContribution,
    FsRuntimeContribution,
    FsActivationContribution,
    FsCommandsContribution,
  ];

  contributionProvider = [FsProviderContribution, CommandContribution, ClientAppContribution];
}