import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';

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
 * 全部走 @opencode-ai/sdk client 的 session.shell (OpenCode Agent bash tool):
 *   1. session.create({ body: { agent: 'build' } })  创建会话
 *   2. session.shell({ sessionID, command, agent })  跑 shell 命令
 *   3. 从返回 parts 里找 tool=bash 的 state.output 拿输出
 *
 * 实测: /file /find/file 在 OpenCode v1.18.10 服务端有参数解析 bug (Missing key),
 * PTY 生命周期太短 (命令跑完 session 即销毁, 读不到输出),
 * session.shell 是唯一可用的同步执行通道.
 *
 * Module: FsCommandsModule, appConfig.modules: [FsCommandsModule] 注入 DI.
 */

export const FS_CMD = {
  LIST: 'taichu.fs.list',
  READ: 'taichu.fs.read',
  WRITE: 'taichu.fs.write',
  FIND: 'taichu.fs.find',
} as const;

const SHELL_AGENT = 'build';
const SHELL_TIMEOUT_MS = 30000;

/** state.output 可能是 string / Buffer(类数组) / 数组, 统一转 string */
function normalizeOutput(output: any): string {
  if (output == null) return '';
  if (typeof output === 'string') return output;
  // Buffer / Uint8Array / 类数组 (如 { 0: 't', 1: 'a', ... })
  if (typeof output.length === 'number') {
    // 数字索引的字符数组
    if (Array.from(output).every((c) => typeof c === 'number' || typeof c === 'string')) {
      return Array.from(output).map((c) => (typeof c === 'number' ? String.fromCharCode(c) : c)).join('');
    }
  }
  if (output.data && typeof output.data.length === 'number') {
    // Uint8Array.data
    return Array.from(output.data)
      .map((c) => String.fromCharCode(c as number))
      .join('');
  }
  return String(output);
}

function extractBashOutput(parts: any[] | undefined): string {
  if (!parts || !Array.isArray(parts)) return '';
  for (const part of parts) {
    if (part?.type === 'tool' && part?.tool === 'bash' && part?.state?.output != null) {
      return normalizeOutput(part.state.output);
    }
  }
  // 兜底: 找任何带 output 的 tool part
  for (const part of parts) {
    if (part?.type === 'tool' && part?.state?.output != null) {
      return normalizeOutput(part.state.output);
    }
  }
  return '';
}

async function runShell(command: string): Promise<string> {
  const client = getFsClient()!; // 从 window.__TAICHU_OPENCODE__ 读 (事件驱动, 不 import)
  // 1. 创建会话 (v2 SDK: agent 是顶层参数)
  const { data: sess, error: createErr } = await client.session.create({
    agent: SHELL_AGENT,
  });
  if (createErr) throw createErr;
  const sessionID = sess?.id;
  if (!sessionID) throw new Error('session.create 未返回 sessionID');

  // 2. 跑命令
  const { data: shellRes, error: shellErr } = await client.session.shell({
    sessionID,
    command,
    agent: SHELL_AGENT,
  });
  if (shellErr) throw shellErr;
  return extractBashOutput(shellRes?.parts);
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
          const output = await runShell(`ls -1 '${path}'`);
          return parseLsLines(output);
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
        execute: async (path: string, content: string) => {
          assertFsReady();
          const escapedPath = path.replace(/'/g, "'\\''");
          // 用 printf 写入: heredoc 在 bash tool 里不落盘, printf + base64 最稳
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
      return parseLsLines(await runShell(`ls -1 '${path}'`));
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
  };
}

/**
 * 绑定沙箱读写同步 — 事件驱动: 监听 'taichu:opencode-ready' (SDK 就绪)
 * 后自动跑一次 fs command 自检, 确认沙箱文件系统可读 (列 /workspace),
 * 结果通过事件派发: 'taichu:fs-sync-ok' / 'taichu:fs-error'.
 */
export function bindFsSync(): () => void {
  const onReady = () => {
    void (async () => {
      try {
        const files = await (window as any).__TAICHU_FS_API__.list('/workspace');
        console.info('[fs] sandbox sync OK, /workspace entries:', (files as string[])?.length ?? 0);
        window.dispatchEvent(new CustomEvent('taichu:fs-sync-ok', { detail: { files } }));
      } catch (err) {
        console.error('[fs] sandbox sync check failed:', err);
        window.dispatchEvent(new CustomEvent('taichu:fs-error', { detail: err }));
      }
    })();
  };
  window.addEventListener('taichu:opencode-ready', onReady);
  return () => window.removeEventListener('taichu:opencode-ready', onReady);
}

@Injectable()
export class FsCommandsModule extends BrowserModule {
  providers = [FsCommandsContribution];

  contributionProvider = CommandContribution;
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