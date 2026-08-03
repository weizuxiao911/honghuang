import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@opensumi/di';
import { Disposable, Emitter } from '@opensumi/ide-core-common';
import { ClientAppContribution } from '@opensumi/ide-core-browser';
import {
  ITerminalServiceClient,
  ITerminalServicePath,
  ITerminalService,
  type IShellLaunchConfig,
} from '@opensumi/ide-terminal-next/lib/common';

/**
 * OpenCode PTY 终端服务 — 把 OpenSumi 终端的 node pty 层替换为 OpenCode /pty
 *
 * 规范: OpenSumi 兼容 VS Code 扩展标准, 终端通过 ITerminalServicePath (node 端服务)
 * 与 browser 的 NodePtyTerminalService 交互. 纯前端无 node 后端, 这里在 browser 端
 * 实现 ITerminalServiceClient (node 端接口), 把 pty 操作映射到 OpenCode /pty
 * (create + WebSocket connect + update + remove).
 *
 * 流程:
 *   - create2(id, cols, rows, launchConfig) → OpenCode pty.create → 返回 pty 包装
 *   - WebSocket 连 /pty/{id}/connect → onData 回调终端
 *   - onMessage(id, json) → WebSocket 发送 input (含 resize 指令)
 *   - disposeById → pty.remove
 */

interface PtyEntry {
  ptyID: string;
  ws: WebSocket;
  closed: boolean;
  name: string;
  pid: number;
}

@Injectable()
export class OpenCodePtyService implements ITerminalServiceClient {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  /** 全局单例 (供 NodePtyTerminalService RPC 回调 + 终端输入转发) */
  static instance: OpenCodePtyService | null = null;

  constructor() {
    OpenCodePtyService.instance = this;
  }

  /** 懒获取 NodePtyTerminalService (避免循环注入) */
  private get terminalService(): any {
    try {
      const ts = this.injector.get(ITerminalService);
      if (!this._tsChecked) {
        this._tsChecked = true;
      }
      return ts;
    } catch (e) {
      return null;
    }
  }
  private _tsChecked = false;

  private entries = new Map<string, PtyEntry>();
  private dataEmitters = new Map<string, Emitter<string>>();
  private exitEmitters = new Map<string, Emitter<{ code?: number; signal?: number }>>();

  get baseUrl(): string {
    const runtime = (window as any).__TAICHU_OPENCODE_RUNTIME__;
    return runtime?.baseUrl ? runtime.baseUrl.replace(/\/agent\/?$/, '') : '';
  }

  get client(): any {
    return (window as any).__TAICHU_OPENCODE__ || null;
  }

  private async ensureReady(): Promise<void> {
    // 等待 opencode client 就绪 (终端可能 attach 过早)
    for (let i = 0; i < 30; i++) {
      if (this.client && this.baseUrl) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error('opencode client not ready');
  }

  private wsUrl(ptyID: string): string {
    return (
      this.baseUrl.replace(/^http/, 'ws').replace(/\/$/, '') +
      `/pty/${ptyID}/connect?directory=${encodeURIComponent('/workspace')}`
    );
  }

  async create2(id: string, cols: number, rows: number, launchConfig: IShellLaunchConfig): Promise<any> {
    await this.ensureReady();
    const client = this.client;

    // OpenSumi launchConfig: executable + args (VS Code 标准 shell 配置)
    // OpenSumi 默认 executable=/bin/sh (非交互无提示符), 强制交互式 bash
    const exec = (launchConfig as any).executable || (launchConfig as any).shellPath || '';
    const isDefaultSh = !exec || exec === '/bin/sh' || exec === 'sh';
    const shellPath = isDefaultSh ? '/bin/bash' : exec;
    const rawArgs: any[] = Array.isArray((launchConfig as any).args)
      ? (launchConfig as any).args
      : [];
    // 默认 shell 用交互模式 (有提示符); 用户显式 shell 尊重其 args
    const args: string[] = isDefaultSh
      ? ['-i']
      : rawArgs.length > 0 ? rawArgs.map(String) : ['-i'];
    // 沙箱工作目录统一为 /workspace (OpenSumi 传入的 launchConfig.cwd 是
    // 本地 workspace 映射 /workspace/workspace, 与沙箱目录不符, 强制覆盖)
    const cwd = '/workspace';

    // 1. 创建远程 PTY
    const { data: pty, error: createErr } = await client.pty.create({
      command: shellPath,
      args,
      cwd,
      directory: '/workspace',
      title: (launchConfig as any).name || 'Terminal',
      env: { ...((launchConfig as any).env || {}), TERM: 'xterm-256color' },
      size: { cols, rows },
    });
    if (createErr) throw createErr;
    const ptyID = pty?.id;
    if (!ptyID) throw new Error('pty.create 未返回 id');

    // 2. WebSocket 连接
    const wsUrl = this.wsUrl(ptyID);
    const ws = new WebSocket(wsUrl);
    let receivedAny = false;
    ws.onopen = () => {
      console.log('[pty] ws OPEN', ptyID);
      // bash 提示符在 create 时输出可能被丢弃 (WS 未连), 但多数情况
      // 初始输出会随 WS 到达; 仅当 500ms 内没收到任何输出时才发 '\r'
      // 触发提示符重绘, 避免重复提示符
      setTimeout(() => {
        try {
          if (!receivedAny) ws.send('\r');
        } catch { /* ignore */ }
      }, 500);
    };
    ws.onclose = () => {
      this.terminalService?.closeClient?.(id, 0);
    };
    const entry: PtyEntry = { ptyID, ws, closed: false, name: shellPath, pid: pty?.pid || 0 };
    this.entries.set(id, entry);

    ws.onmessage = (e) => {
      const data: any = e.data;
      const push = (t: string) => {
        receivedAny = true;
        const trimmed = t.replace(/^\u0000+/, '');
        if (trimmed.startsWith('{"cursor"') || trimmed.startsWith('{"type":"cursor"')) return;
        // 延迟 300ms 派发, 等 resolveConnection 注册好 onData handler
        setTimeout(() => {
          const ts = this.terminalService;
          if (ts?.onMessage) {
            ts.onMessage(id, trimmed);
          } else {
            this.dataEmitters.get(id)?.fire(trimmed);
          }
        }, 300);
      };
      if (typeof data === 'string') {
        push(data);
      } else if (data instanceof Blob) {
      } else if (data instanceof ArrayBuffer) {
        push(new TextDecoder().decode(data));
      }
    };
    ws.onclose = () => {
      entry.closed = true;
      this.terminalService?.closeClient?.(id, 0);
      this.exitEmitters.get(id)?.fire({ code: 0 });
    };
    ws.onerror = () => { /* onclose 兜底 */ };

    // 3. 返回 pty 包装 (NodePtyTerminalService._createCustomWebSocket 需要的字段)
    return {
      name: shellPath,
      pid: pty?.pid || 0,
      onData: (handler: (data: string) => void) => {
        if (!this.dataEmitters.has(id)) this.dataEmitters.set(id, new Emitter<string>());
        const disp = this.dataEmitters.get(id)!.event(handler);
        return { dispose: () => disp.dispose() };
      },
      onExit: (handler: (code: number, signal?: number) => void) => {
        if (!this.exitEmitters.has(id)) this.exitEmitters.set(id, new Emitter<{ code?: number; signal?: number }>());
        const disp = this.exitEmitters.get(id)!.event((e) => handler(e.code ?? 0, e.signal));
        return { dispose: () => disp.dispose() };
      },
      sendData: (message: string) => {
        this.onMessage(id, JSON.stringify({ data: message }));
      },
    };
  }

  onMessage(id: string, msg: string): void {
    const entry = this.entries.get(id);
    if (!entry || entry.closed) return;
    // 解析 NodePtyTerminalService 的消息格式 { id, data? | method? }
    try {
      const json = JSON.parse(msg);
      if (json.method === 'resize') {
        const { cols, rows } = json.params || {};
        if (cols && rows && this.client) {
          this.client.pty.update({
            ptyID: entry.ptyID,
            directory: '/workspace',
            size: { cols, rows },
          }).catch(() => { /* ignore */ });
        }
        return;
      }
      if (json.data != null) {
        // PTY WebSocket 期望原始文本输入 (终端按键直接发字符)
        console.log('[pty] send raw', String(json.data).slice(0, 30));
        entry.ws.send(String(json.data));
      }
    } catch {
      // 非 JSON → 直接作为原始输入
      entry.ws.send(msg);
    }
  }

  resize(id: string, rows: number, cols: number): void {
    const entry = this.entries.get(id);
    if (!entry || !this.client) return;
    this.client.pty.update({
      ptyID: entry.ptyID,
      directory: '/workspace',
      size: { rows, cols },
    }).catch(() => { /* ignore */ });
  }

  disposeById(id: string): void {
    const entry = this.entries.get(id);
    if (!entry) return;
    if (!entry.closed) {
      try { entry.ws.close(); } catch { /* ignore */ }
    }
    if (this.client) {
      this.client.pty.remove({ ptyID: entry.ptyID, directory: '/workspace' }).catch(() => { /* ignore */ });
    }
    this.entries.delete(id);
    this.dataEmitters.delete(id);
    this.exitEmitters.delete(id);
  }

  dispose(): void {
    for (const id of Array.from(this.entries.keys())) {
      this.disposeById(id);
    }
  }

  getProcessId(id: string): number {
    return this.entries.get(id)?.pid || 0;
  }

  getShellName(id: string): string {
    return this.entries.get(id)?.name || 'sh';
  }

  async getCwd(id: string): Promise<string | undefined> {
    return '/workspace';
  }

  clientMessage(id: string, data: string): void {
    this.dataEmitters.get(id)?.fire(data);
  }

  closeClient(sessionId: string, data?: any, signal?: number): void {
    this.exitEmitters.get(sessionId)?.fire({ code: typeof data === 'number' ? data : 0, signal });
  }

  processChange(clientId: string, processName: string): void {
    /* noop */
  }

  setConnectionClientId(clientId: string): void {
    /* noop */
  }

  ensureTerminal(terminalIdArr: string[]): Promise<boolean> {
    return Promise.resolve(true);
  }

  async $resolveWindowsShellPath(type: any): Promise<string | undefined> {
    return '/bin/sh';
  }

  async $resolveUnixShellPath(type: string): Promise<string | undefined> {
    return '/bin/sh';
  }

  async $resolveShellPath(paths: string[]): Promise<string | undefined> {
    return paths[0] || '/bin/sh';
  }

  async detectAvailableProfiles(options: any): Promise<any[]> {
    return [{ path: '/bin/sh', name: 'sh', isDefault: true }];
  }

  async getDefaultSystemShell(os: any): Promise<string> {
    return '/bin/sh';
  }

  getOS(): any {
    return 3; // OperatingSystem.Linux
  }

  async getCodePlatformKey(): Promise<'osx' | 'windows' | 'linux'> {
    return 'linux';
  }
}

/**
 * 终端注入 — 在 App 启动时把 ITerminalServicePath 替换为 OpenCode PTY 实现
 * (覆盖 connection.js 注册的 RPC stub)
 */
@Injectable()
export class TerminalSetupContribution implements ClientAppContribution {
  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  onStart(): void {
    // 用 OpenCode PTY 服务覆盖 ITerminalServicePath (RPC stub)
    this.injector.addProviders({
      token: ITerminalServicePath,
      useValue: this.injector.get(OpenCodePtyService),
    });
  }
}
