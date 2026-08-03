import type { IAppRendererProps } from '@codeblitzjs/ide-core';

/**
 * 运行时配置 — CodeBlitz runtimeConfig
 *
 * 文件系统: OverlayFS (IndexedDB 可写 + DynamicRequest 只读)
 *   - writable: IndexedDB    — 本地可写层 (浏览器 IndexedDB, 用户编辑保存)
 *   - readable: DynamicRequest — 远程只读层 (从沙箱拉取, 通过 fs command 走 SDK)
 *   - OverlayFS 合并: 读文件先查本地(修改过的), 没有则从沙箱拉
 *
 * 读写同步 (事件钩子):
 *   - onDidSaveTextDocument → 保存时同步写沙箱 (fs.write via SDK)
 *   - onDidCreateFiles      → 创建时同步沙箱 (fs.create)
 *   - onDidDeleteFiles      → 删除时同步沙箱 (fs.delete)
 *   - 沙箱读 (DynamicRequest 回调) → fs.list / fs.read
 *
 * 沙箱未就绪 (SDK client 未创建) 时, 回调直接返回空/忽略, 不阻塞 IDE.
 */

/** 沙箱文件类型: 0 未知 / 1 文件 / 2 目录 (BrowserFS FileType) */
const FILE_TYPE_FILE = 1;
const FILE_TYPE_DIR = 2;

/** 沙箱工作区根: OverlayFS 挂载在 /, DynamicRequest 回调收到的 path 是相对根的, 映射到沙箱 /workspace */
const SANDBOX_ROOT = '/workspace';

/** IDE path (如 / 或 /foo.txt) → 沙箱 path (/workspace/foo.txt) */
function toSandboxPath(path: string): string {
  const p = path.replace(/^\//, '');
  return p ? `${SANDBOX_ROOT}/${p}` : SANDBOX_ROOT;
}

/** 调用沙箱 fs command (走 SDK, 事件驱动; 未就绪返回空) */
async function sandboxList(path: string): Promise<Array<[string, number]>> {
  const fsApi = (window as any).__TAICHU_FS_API__;
  if (!fsApi?.isReady?.()) return [];
  try {
    const entries: Array<{ name: string; type?: number }> = await fsApi.list(toSandboxPath(path));
    return (entries || []).map((e) => [e.name, e.type === 2 ? FILE_TYPE_DIR : FILE_TYPE_FILE] as [string, number]);
  } catch {
    return [];
  }
}

async function sandboxRead(path: string): Promise<Uint8Array> {
  const fsApi = (window as any).__TAICHU_FS_API__;
  if (!fsApi?.isReady?.()) return new Uint8Array();
  try {
    const content: string = await fsApi.read(toSandboxPath(path));
    return new TextEncoder().encode(content || '');
  } catch {
    return new Uint8Array();
  }
}

/** 保存/变更/创建/删除 → 同步沙箱 (写) */
function syncToSandbox(
  op: 'write' | 'create' | 'delete',
  filepath: string,
  content?: string
): void {
  const fsApi = (window as any).__TAICHU_FS_API__;
  if (!fsApi?.isReady?.()) return;
  const sandboxPath = `/workspace/${filepath.replace(/^\//, '')}`;
  void (async () => {
    try {
      if (op === 'write' && typeof content === 'string') {
        await fsApi.write(sandboxPath, content);
      } else if (op === 'create') {
        await fsApi.write(sandboxPath, content || '');
      } else if (op === 'delete') {
        await fsApi.delete?.(sandboxPath);
      }
    } catch (err) {
      console.warn('[runtime] sync to sandbox failed:', op, sandboxPath, err);
    }
  })();
}

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  workspace: {
    filesystem: {
      fs: 'OverlayFS',
      options: {
        writable: { fs: 'IndexedDB' },
        readable: {
          fs: 'DynamicRequest',
          options: {
            readDirectory: (path: string) => sandboxList(path),
            readFile: (path: string) => sandboxRead(path),
          },
        },
      },
    },
    // 读写同步钩子: 编辑器操作 → 同步沙箱 (走 fs command)
    onDidSaveTextDocument: ({ filepath, content }) => {
      syncToSandbox('write', filepath, content);
    },
    onDidChangeTextDocument: ({ filepath, content }) => {
      // 变更不即时同步 (防抖由保存触发), 这里仅记录
    },
    onDidCreateFiles: (files) => {
      (files || []).forEach((f) => syncToSandbox('create', f));
    },
    onDidDeleteFiles: (files) => {
      (files || []).forEach((f) => syncToSandbox('delete', f));
    },
  },
} as any;