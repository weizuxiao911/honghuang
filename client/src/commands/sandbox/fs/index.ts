import { Injectable, Autowired } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry, URI } from '@opensumi/ide-core-common';
import { BrowserModule, ClientAppContribution } from '@opensumi/ide-core-browser';
import { IFileTreeService } from '@opensumi/ide-file-tree-next/lib/common';
import { IWorkspaceService } from '@opensumi/ide-workspace/lib/common';

import { assertFsReady, getFsClient } from './api';

/**
 * fs commands — 跨拓展 IO 统一入口 (按工具集分组维护)
 *
 * 命名约定: taichu.fs.{action}
 *   taichu.fs.list   (path)            → string[]    列目录 (文件名列表)
 *   taichu.fs.read   (path)            → string      读文件内容
 *   taichu.fs.write  (path, content)   → void        写文件 (create or overwrite)
 *   taichu.fs.find   (path, pattern?)  → string[]    搜索文件
 *
 * 实现策略:
 *   - list / read / find 走 v2.fs API (GET /api/fs/*, 不创建会话)
 *   - write / mkdir 走 session.shell (agent build bash tool, 复用 shell 会话)
 *
 * Module: FsCommandsModule, appConfig.modules: [FsCommandsModule] 注入 DI.
 */

export const FS_CMD = {
  LIST: 'taichu.fs.list',
  READ: 'taichu.fs.read',
  WRITE: 'taichu.fs.write',
  FIND: 'taichu.fs.find',
} as const;

const SHELL_TIMEOUT_MS = 30000;

/**
 * runShell — 通过 PTY + WebSocket 执行命令 (不创建会话)
 *
 * 流程:
 *   1. pty.create({ command: '/bin/sh', args: ['-c', command], cwd, directory }) → ptyID
 *   2. WebSocket 直连 ws://{base}/pty/{ptyID}/connect?directory=... → 实时收输出
 *   3. 命令跑完 (pty get status=exited) → pty.remove 清理
 */
export async function runShell(command: string): Promise<string> {
  const client = getFsClient()!;
  const runtime = (window as any).__TAICHU_OPENCODE_RUNTIME__;
  if (!runtime?.baseUrl) throw new Error('runtime not ready');
  const apiBase = runtime.baseUrl.replace(/\/agent\/?$/, '');

  // 1. 创建 PTY (bash -c 执行命令)
  const { data: pty, error: createErr } = await client.pty.create({
    command: '/bin/sh',
    args: ['-c', command],
    cwd: '/workspace',
    directory: '/workspace',
  });
  if (createErr) throw createErr;
  const ptyID = pty?.id;
  if (!ptyID) throw new Error('pty.create 未返回 id');

  // 2. WebSocket 收输出
  const wsUrl = apiBase
    .replace(/^http/, 'ws')
    .replace(/\/$/, '') + `/pty/${ptyID}/connect?directory=${encodeURIComponent('/workspace')}`;

  const output = await new Promise<string>((resolve, reject) => {
    let ws: WebSocket | null = null;
    let chunks: string[] = [];
    let settled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const finish = (code: number) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      try { ws?.close(); } catch { /* ignore */ }
      resolve(chunks.join(''));
    };

    const fail = (err: any) => {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      try { ws?.close(); } catch { /* ignore */ }
      reject(err);
    };

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      fail(e);
      return;
    }

    ws.onopen = () => {
      // 开始轮询 pty 状态, 命令结束后关闭 ws
      pollTimer = setInterval(async () => {
        try {
          const g = await client.pty.get({ ptyID, directory: '/workspace' });
          if (g.data?.status === 'exited') {
            // 等 500ms 收完剩余输出再关
            setTimeout(() => finish(0), 800);
          }
        } catch { /* pty 可能已销毁 */ }
      }, 500);
    };
    ws.onmessage = (e) => {
      const data: any = e.data;
      const push = (t: string) => {
        // 过滤 PTY 协议控制消息: \u0000 前缀 / {"cursor":...} JSON
        const trimmed = t.replace(/^\u0000+/, '');
        if (trimmed.startsWith('{"cursor"') || trimmed.startsWith('{"type":"cursor"')) return;
        chunks.push(trimmed);
      };
      if (typeof data === 'string') {
        push(data);
      } else if (data instanceof Blob) {
        data.text().then(push).catch(() => { /* ignore */ });
      } else if (data instanceof ArrayBuffer) {
        push(new TextDecoder().decode(data));
      }
    };
    ws.onerror = () => {
      // 连接失败不立即失败, 由轮询兜底 (可能命令已跑完)
      if (!pollTimer) fail(new Error('pty ws connect failed'));
    };
    ws.onclose = () => finish(0);

    // 超时兜底 (30s)
    setTimeout(() => {
      if (!settled) {
        try {
          client.pty.remove({ ptyID, directory: '/workspace' }).catch(() => { /* ignore */ });
        } catch { /* ignore */ }
        finish(0);
      }
    }, SHELL_TIMEOUT_MS);
  });

  // 3. 清理 PTY
  try {
    client.pty.remove({ ptyID, directory: '/workspace' }).catch(() => { /* ignore */ });
  } catch { /* ignore */ }

  return output;
}

function parseLsLines(output: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l !== '.' && l !== '..')
    .map((l) => {
      // ls -1 每行一个文件名; 若带权限/属性 (ls -la), 取最后一段
      const parts = l.split(/\s+/);
      return parts[parts.length - 1];
    });
}

function parseFindLines(output: string, basePath: string): string[] {
  return output
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => (basePath && l.startsWith(basePath) ? l.slice(basePath.length + 1) : l));
}

@Injectable()
@Domain(CommandContribution)
export class FsCommandsContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: FS_CMD.LIST },
      {
        execute: async (path: string) => {
          assertFsReady();
          // list 走 v2.fs API (不创建会话)
          const client = getFsClient()!;
          const { data, error } = await (client as any).v2.fs.list({ path });
          if (error) throw error;
          const list: any[] = Array.isArray(data) ? data : (data?.data || []);
          return list.map((e) => String(e.path || e.name || e)).filter(Boolean);
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.READ },
      {
        execute: async (path: string) => {
          assertFsReady();
          return await runShell(`cat '${path}'`);
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.WRITE },
      {
        execute: async (path: string, content: string | Uint8Array) => {
          assertFsReady();
          const escapedPath = path.replace(/'/g, "'\\''");
          // Uint8Array 直接 base64 编码后落盘 (二进制图片/PDF 安全);
          // string 按 UTF-8 字节写入 (代码/文本)
          const b64 = bytesToBase64(content);
          const script = `printf '%s' '${b64}' | base64 -d > '${escapedPath}'`;
          await runShell(script);
          return true;
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.FIND },
      {
        execute: async (path: string, pattern = '*') => {
          assertFsReady();
          const output = await runShell(`find '${path}' -maxdepth 4 -name '${pattern}'`);
          return parseFindLines(output, path);
        },
      }
    );
  }
}

/**
 * installFsApi — 挂 window.__TAICHU_FS_API__ 便捷访问.
 * 内部全部走 SDK client session.shell, 不直连 HTTP.
 */
export function installFsApi(): void {
  (window as any).__TAICHU_FS_API__ = {
    getClient: getFsClient,
    isReady: () => !!getFsClient(),
    list: async (path: string) => {
      assertFsReady();
      // 列目录走 SDK v2.fs.list (裸 fetch /file?path= 的 query 解析有问题 400)
      const client = getFsClient()!;
      const { data, error } = await (client as any).v2.fs.list({ path });
      if (error) throw error;
      const list: any[] = Array.isArray(data) ? data : (data?.data || []);
      // 返回 {name, type} (1 文件 / 2 目录), 供 DynamicRequest 区分目录
      return list.map((e) => ({
        name: String(e.path ?? e.name ?? e),
        type: e.type === 'directory' ? 2 : 1,
      })).filter((e) => e.name.length > 0);
    },
    read: async (path: string) => {
      assertFsReady();
      return await runShell(`cat '${path}'`);
    },
    write: async (path: string, content: string) => {
      assertFsReady();
      const escapedPath = path.replace(/'/g, "'\\''");
      const b64 = bytesToBase64(content);
      const script = `printf '%s' '${b64}' | base64 -d > '${escapedPath}'`;
      await runShell(script);
      return true;
    },
    find: async (path: string, pattern = '*') => {
      assertFsReady();
      return parseFindLines(await runShell(`find '${path}' -maxdepth 4 -name '${pattern}'`), path);
    },
    delete: async (path: string) => {
      assertFsReady();
      const escapedPath = path.replace(/'/g, "'\\''");
      await runShell(`rm -rf '${escapedPath}'`);
      return true;
    },
  };
}

/**
 * 绑定沙箱读写同步 — 事件驱动: 监听 'taichu:opencode-ready' (SDK 就绪)
 * 后自动跑一次 fs command 自检, 确认沙箱文件系统可读 (列 /workspace).
 * 失败会重试 (1s→2s→4s→8s cap), 不弹错误 overlay.
 * 结果通过事件派发: 'taichu:fs-sync-ok'.
 */
export function bindFsSync(): () => void {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attempt = 0;

  const attemptSync = async () => {
    try {
      const files = await (window as any).__TAICHU_FS_API__.list('/workspace');
      if (cancelled) return;
      console.info('[fs] sandbox sync OK, /workspace entries:', (files as string[])?.length ?? 0);
      window.dispatchEvent(new CustomEvent('taichu:fs-sync-ok', { detail: { files } }));
      attempt = 0;
    } catch (err) {
      if (cancelled) return;
      console.warn('[fs] sandbox sync check failed (attempt ' + (attempt + 1) + '):', err);
      attempt += 1;
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
      timer = setTimeout(attemptSync, delay);
    }
  };

  const onReady = () => {
    attempt = 0;
    void attemptSync();
  };
  window.addEventListener('taichu:opencode-ready', onReady);
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener('taichu:opencode-ready', onReady);
  };
}

@Injectable()
export class FsCommandsModule extends BrowserModule {
  providers = [FsCommandsContribution, FsExplorerRefreshContribution];

  contributionProvider = [CommandContribution, ClientAppContribution];
}

/**
 * 登出后清空文件树: teardownRuntime → taichu:fs-teardown →
 * 移除 workspace roots + 重置 workspace (explorer 不再显示旧沙箱文件)
 */
@Injectable()
@Domain(ClientAppContribution)
export class FsExplorerRefreshContribution implements ClientAppContribution {
  @Autowired(IFileTreeService)
  private fileTreeService: IFileTreeService;

  @Autowired(IWorkspaceService)
  private workspaceService: IWorkspaceService;

  onStart(): void {
    // 登录后沙箱就绪 → 文件树重新加载 (显示沙箱文件)
    // fs-ready 瞬间沙箱 /file 接口可能未完全可用, 延迟 + 重试直到 readDirectory 有内容
    // 不手动 setWorkspace (CodeBlitz 自动初始化 workspace root, 手动设会挂错路径)
    window.addEventListener('taichu:fs-ready', () => {
      const reload = () => {
        try {
          this.fileTreeService.refresh();
        } catch {
          /* ignore */
        }
      };
      // 首次延迟 1.5s (等沙箱文件接口稳定), 再补一次 3s 兜底
      setTimeout(reload, 1500);
      setTimeout(reload, 3500);
    });

    window.addEventListener('taichu:fs-teardown', () => {
      // 登出: 清空 browserfs (浏览器文件系统数据, 文件树数据源) —
      // 本地创建的缓存文件一并删除, 下次登录从沙箱重新同步
      try {
        const req = indexedDB.open('browserfs');
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction('browserfs', 'readwrite');
          tx.objectStore('browserfs').clear();
          tx.oncomplete = () => db.close();
        };
      } catch {
        /* ignore */
      }
      try {
        const roots = this.workspaceService.tryGetRoots();
        if (roots.length > 0) {
          void this.workspaceService.removeRoots(roots.map((r) => new URI(r.uri)));
        }
        void this.workspaceService.setWorkspace(undefined);
      } catch {
        /* ignore */
      }
      try {
        this.fileTreeService.refresh();
      } catch {
        /* ignore */
      }
    });
  }
}

/** Uint8Array / string → base64 (浏览器) */
function bytesToBase64(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}