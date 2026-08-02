/**
 * SandboxFileSystemProvider — OpenSumi FileSystemProvider 实现
 *
 * 单一 provider 实例, 内部维护 'active' 状态:
 *   - active=false (未登录/未拿到 baseUrl): 所有操作抛错或返回空 (placeholder 行为)
 *   - active=true (登录后 fs-ready): 真实调用沙箱 HTTP API
 *
 * 状态切换: setActive(true/false) — 由 FsActivationContribution 监听
 * 'taichu:fs-ready' / 'taichu:fs-teardown' 事件调用.
 *
 * uri (e.g. 'sandbox:/workspace/foo') ↔ abs path (e.g. '/workspace/foo'):
 *   - 直接取 uri.path 作为 abs path
 *   - 沙箱内 root '/' 对应 sandbox scheme root
 *
 * 沙箱内 HTTP API 映射:
 *   - readDirectory / stat  → GET  ${baseUrl}/file?path=<abs>
 *   - readFile             → GET  ${baseUrl}/file/content?path=<abs>
 *   - writeFile            → POST ${baseUrl}/pty  (printf + base64)
 *   - createDirectory      → POST ${baseUrl}/pty  (mkdir -p)
 *   - delete               → POST ${baseUrl}/pty  (rm -rf)
 *
 * watch: 沙箱 agent-image 不暴露文件 watch API, noop 占位
 */

import { Uri } from '@opensumi/ide-core-common';
import {
  FileSystemProvider,
  FileType,
  FileStat,
  FileChangeEvent,
} from '@opensumi/ide-file-service/lib/common/files';
import { Emitter, Event } from '@opensumi/ide-core-common';

// const enum 跨模块编译会丢失, 用数值替代
const FILE_READ_WRITE = 2;

import { fsFetch, isRuntimeReady, FSError, bytesToBase64 } from './api';

const SCHEME = 'sandbox';

export interface FileEntryJson {
  name: string;
  type: 'file' | 'directory' | 'symlink' | 'other';
  size?: number;
  mtime?: number;
}

export class SandboxFileSystemProvider implements FileSystemProvider {
  readonly capabilities: number = FILE_READ_WRITE;

  readonly onDidChangeCapabilities: Event<void> = new Emitter<void>().event;

  private readonly _onDidChangeFile = new Emitter<FileChangeEvent>();
  readonly onDidChangeFile: Event<FileChangeEvent> = this._onDidChangeFile.event;

  // FileChangeEvent 实际是 FileChange[] 类型别名, fire 时传单个 FileChange 包成数组
  private fireChange(type: 1 | 2 | 3, uri: string) {
    this._onDidChangeFile.fire([{ type, uri } as any]);
  }

  readonly readonly: boolean = false;

  private _active = false;

  setActive(active: boolean): void {
    this._active = active;
  }

  isActive(): boolean {
    return this._active && isRuntimeReady();
  }

  private requireActive(): void {
    if (!this.isActive()) {
      throw new FSError(0, '', 'fs sandbox not active (login 后会自动激活)');
    }
  }

  private static uriToPath(uri: Uri): string {
    return uri.path || '/';
  }

  private async listDir(absPath: string): Promise<FileEntryJson[]> {
    const resp = await fsFetch<any>('GET', '/file', { params: { path: absPath } });
    if (Array.isArray(resp)) return resp as FileEntryJson[];
    if (resp && Array.isArray(resp.entries)) return resp.entries as FileEntryJson[];
    if (resp && Array.isArray(resp.files)) return resp.files as FileEntryJson[];
    return [];
  }

  async stat(uri: Uri): Promise<FileStat | void> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    if (abs === '/' || abs === '') {
      return {
        uri: uri.toString(),
        lastModification: Date.now(),
        isDirectory: true,
        type: FileType.Directory,
      } as FileStat;
    }
    const parent = abs.replace(/\/+$/, '').split('/').slice(0, -1).join('/') || '/';
    const base = abs.replace(/\/+$/, '').split('/').pop() || '';
    const entries = await this.listDir(parent);
    const entry = entries.find((e) => e.name === base);
    if (!entry) return undefined;
    return {
      uri: uri.toString(),
      lastModification: entry.mtime ? entry.mtime * 1000 : Date.now(),
      createTime: entry.mtime ? entry.mtime * 1000 : undefined,
      isDirectory: entry.type === 'directory',
      size: entry.size,
      type:
        entry.type === 'directory'
          ? FileType.Directory
          : entry.type === 'symlink'
            ? FileType.SymbolicLink
            : FileType.File,
    } as FileStat;
  }

  async readDirectory(uri: Uri): Promise<[string, FileType][]> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    const entries = await this.listDir(abs);
    return entries.map((e) => [
      e.name,
      e.type === 'directory'
        ? FileType.Directory
        : e.type === 'symlink'
          ? FileType.SymbolicLink
          : FileType.File,
    ]);
  }

  async createDirectory(uri: Uri): Promise<void | FileStat> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    await fsFetch('POST', '/pty', {
      body: { script: `mkdir -p '${abs.replace(/'/g, "'\\''")}'` },
    });
    this.fireChange(2, uri.toString());
    return this.stat(uri) as Promise<FileStat | void>;
  }

  async readFile(uri: Uri): Promise<Uint8Array> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    const text = await fsFetch<string>('GET', '/file/content', {
      params: { path: abs },
      timeoutMs: 30000,
    });
    return new TextEncoder().encode(text);
  }

  async writeFile(
    uri: Uri,
    content: Uint8Array,
    options: { create: boolean; overwrite: boolean }
  ): Promise<void> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    const b64 = bytesToBase64(content);
    const script = `set -e; mkdir -p "$(dirname '${abs}')"; printf %s '${b64}' | base64 -d > '${abs}'`;
    await fsFetch('POST', '/pty', { body: { script } });
    this.fireChange(1, uri.toString());
  }

  async delete(uri: Uri, options?: { recursive?: boolean; moveToTrash?: boolean }): Promise<void> {
    this.requireActive();
    const abs = SandboxFileSystemProvider.uriToPath(uri);
    const recursive = options?.recursive !== false ? '-rf' : '';
    await fsFetch('POST', '/pty', {
      body: { script: `rm ${recursive} '${abs}'` },
    });
    this.fireChange(3, uri.toString());
  }

  async rename(
    oldUri: Uri,
    newUri: Uri,
    options: { overwrite: boolean }
  ): Promise<void> {
    this.requireActive();
    const oldAbs = SandboxFileSystemProvider.uriToPath(oldUri);
    const newAbs = SandboxFileSystemProvider.uriToPath(newUri);
    await fsFetch('POST', '/pty', {
      body: { script: `mv '${oldAbs}' '${newAbs}'` },
    });
    this.fireChange(3, oldUri.toString());
    this.fireChange(1, newUri.toString());
  }

  watch(): number {
    return -1;
  }
}

export const SANDBOX_SCHEME = SCHEME;

export function newSandboxFileSystemProvider(): SandboxFileSystemProvider {
  return new SandboxFileSystemProvider();
}