import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { BrowserFSFileType as FileType } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { WelcomePage } from '../components/WelcomePage';
import { OpencodeFileClient, OpencodeFileEntry } from '../services/opencode';
import { getRuntimeConfig } from './runtime';
import { LayoutComponent } from './layout';

// fileClient 延迟读取 baseUrl：模块导入时 runtime 尚未解析，
// 每次调用通过 getRuntimeConfig() 拿当前注入值。
let fileClient: OpencodeFileClient | null = null;
function getFileClient(): OpencodeFileClient {
  if (!fileClient) {
    const { baseUrl } = getRuntimeConfig();
    if (!baseUrl) {
      throw new Error('[Taichu] runtime baseUrl not resolved yet');
    }
    fileClient = new OpencodeFileClient(baseUrl);
  }
  return fileClient;
}

function toFileEntries(entries: OpencodeFileEntry[]): [string, FileType][] {
  return entries.map((entry) => [
    entry.name,
    entry.type === 'directory' ? FileType.DIRECTORY : FileType.FILE,
  ]);
}

// onDidCreateFiles 回调只给相对路径字符串，不区分文件/目录（实测：新建 test2 文件夹回调传 ["test2"]）。
// 启发式：末段含扩展名（.xxx）视为文件，否则视为目录。生产应改用文件系统 stat 精确判断。
function looksLikeFile(filepath: string): boolean {
  const base = filepath.split('/').pop() || '';
  return /\.[^.]+$/.test(base);
}

export const appConfig: IAppRendererProps['appConfig'] = {
  workspaceDir: 'workspace',
  layoutComponent: LayoutComponent as any,
  layoutConfig: {
    [SlotLocation.top]: { modules: [] },
    [SlotLocation.action]: { modules: [] },
    [SlotLocation.left]: {
      modules: [
        '@opensumi/ide-explorer',
        '@opensumi/ide-search',
        '@opensumi/ide-scm',
        '@opensumi/ide-debug',
      ],
    },
    [SlotLocation.right]: { modules: [] },
    [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
    [SlotLocation.bottom]: { modules: ['@opensumi/ide-output', '@opensumi/ide-markers'] },
    [SlotLocation.statusBar]: { modules: ['@opensumi/ide-status-bar'] },
    [SlotLocation.extra]: { modules: [] },
  } as any,
  defaultPreferences: {
    'general.theme': 'opensumi-design-dark-theme',
    'editor.autoSave': 'afterDelay',
    'editor.autoSaveDelay': 1000,
    'workbench.startupEditor': 'none',
    'breadcrumbs.enabled': false,
  },
  defaultPanels: {
    left: '@opensumi/ide-explorer',
    bottom: '',
    right: '',
  },
} as any;

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  // startupEditor: 'welcomePage' 保证首屏在 editor 区打开一个欢迎 tab；
  // WelcomePage 覆盖 CodeBlitz 默认的 Codeblitz 品牌页为Taichu自制欢迎页。
  startupEditor: 'welcomePage',
  WelcomePage: WelcomePage as any,
  workspace: {
    filesystem: {
      fs: 'OverlayFS',
      options: {
        writable: { fs: 'IndexedDB' },
        readable: {
          fs: 'DynamicRequest',
          options: {
            async readDirectory(p: string) {
              const entries = await getFileClient().readDirectory(p);
              return toFileEntries(entries);
            },
            async readFile(p: string) {
              return getFileClient().readFile(p);
            },
          },
        },
      },
    },
    async onDidSaveTextDocument({ filepath, content }) {
      try {
        await getFileClient().writeFile(filepath, content);
      } catch (error) {
        console.error(`[Taichu] 写回 opencode 失败: ${filepath}`, error);
      }
    },
    async onDidCreateFiles(files: string[]) {
      await Promise.all(
        files.map(async (filepath) => {
          try {
            if (looksLikeFile(filepath)) {
              await getFileClient().createFile(filepath);
            } else {
              await getFileClient().createDirectory(filepath);
            }
          } catch (error) {
            console.error(`[Taichu] 新建写回失败: ${filepath}`, error);
          }
        })
      );
    },
    async onDidDeleteFiles(files: string[]) {
      await Promise.all(
        files.map(async (filepath) => {
          try {
            await getFileClient().deletePath(filepath);
          } catch (error) {
            console.error(`[Taichu] 删除写回失败: ${filepath}`, error);
          }
        })
      );
    },
  },
};
