import { Injectable } from '@opensumi/di';
import { Domain, CommandContribution, CommandRegistry } from '@opensumi/ide-core-common';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { fsFetch, FSError, isRuntimeReady, bytesToBase64 } from './api';

/**
 * fs commands — 跨拓展 IO 统一入口 (按工具集分组维护)
 *
 * 命名约定: taichu.fs.{action}
 *   taichu.fs.list     (path)            → string[]      列表 (浅一层)
 *   taichu.fs.read     (path)            → string        读文件内容 (utf-8)
 *   taichu.fs.write    (path, content)   → void          写文件 (create or overwrite)
 *   taichu.fs.create   (path, type?)     → void          创建空文件或目录
 *   taichu.fs.delete   (path, opts?)     → void          删除文件或目录
 *   taichu.fs.upload   (path, file)      → void          上传本地文件到沙箱 (multipart/form-data)
 *
 * 跨拓展 IO 一律经此, 不得直接 fetch ${baseUrl}/file...
 * 沙箱内绝对路径: e.g. "/workspace/foo.txt"
 *
 * Module: FsCommandsModule (BrowserModule + contributionProvider = CommandContribution),
 * 通过 appConfig.modules: [FsCommandsModule] 注入 DI 即可使用.
 */

export const FS_CMD = {
  LIST: 'taichu.fs.list',
  READ: 'taichu.fs.read',
  WRITE: 'taichu.fs.write',
  CREATE: 'taichu.fs.create',
  DELETE: 'taichu.fs.delete',
  UPLOAD: 'taichu.fs.upload',
} as const;

function ensureRuntime(): void {
  if (!isRuntimeReady()) {
    throw new FSError(0, '', 'fs runtime not ready (login 后会自动激活)');
  }
}

@Injectable()
@Domain(CommandContribution)
export class FsCommandsContribution implements CommandContribution {
  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(
      { id: FS_CMD.LIST },
      {
        execute: async (path: string) => {
          ensureRuntime();
          const resp = await fsFetch<any>('GET', '/file', { params: { path } });
          const list = Array.isArray(resp) ? resp : resp.entries || resp.files || [];
          return list.map((e: any) => e.name);
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.READ },
      {
        execute: async (path: string) => {
          ensureRuntime();
          return await fsFetch<string>('GET', '/file/content', { params: { path } });
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.WRITE },
      {
        execute: async (path: string, content: string) => {
          ensureRuntime();
          const b64 = bytesToBase64(new TextEncoder().encode(content));
          const script = `set -e; mkdir -p "$(dirname '${path}')"; printf %s '${b64}' | base64 -d > '${path}'`;
          await fsFetch('POST', '/pty', { body: { script } });
          return true;
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.CREATE },
      {
        execute: async (path: string, type: 'file' | 'directory' = 'file') => {
          ensureRuntime();
          const script =
            type === 'directory'
              ? `mkdir -p '${path}'`
              : `mkdir -p "$(dirname '${path}')"; touch '${path}'`;
          await fsFetch('POST', '/pty', { body: { script } });
          return true;
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.DELETE },
      {
        execute: async (path: string, opts?: { recursive?: boolean }) => {
          ensureRuntime();
          const recursive = opts?.recursive !== false ? '-rf' : '';
          await fsFetch('POST', '/pty', {
            body: { script: `rm ${recursive} '${path}'` },
          });
          return true;
        },
      }
    );

    commands.registerCommand(
      { id: FS_CMD.UPLOAD },
      {
        execute: async (path: string, file: File | Blob, name?: string) => {
          ensureRuntime();
          const fd = new FormData();
          const fileName = name || (file as File).name || 'upload';
          fd.append('file', file, fileName);
          fd.append('path', path);
          await fsFetch('POST', '/upload', {
            body: fd,
            timeoutMs: 60000,
          });
          return true;
        },
      }
    );
  }
}

/**
 * FsCommandsModule — BrowserModule + CommandContribution,
 * 通过 appConfig.modules: [FsCommandsModule] 注入 DI 即可使用 commands.
 */
@Injectable()
export class FsCommandsModule extends BrowserModule {
  providers = [FsCommandsContribution];

  contributionProvider = CommandContribution;
}