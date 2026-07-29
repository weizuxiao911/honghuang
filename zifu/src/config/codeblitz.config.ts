import type { IAppRendererProps } from '@codeblitzjs/ide-core';
import { BrowserFSFileType as FileType } from '@codeblitzjs/ide-core';
import { SlotLocation } from '@opensumi/ide-core-browser';

import { OpencodeFileClient, OpencodeFileEntry } from '../services/opencode';
import { LayoutComponent } from './layout';

const OPENCODE_BASE_URL = process.env.OPENCODE_BASE_URL || 'http://127.0.0.1:24096';

const fileClient = new OpencodeFileClient(OPENCODE_BASE_URL);

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
    [SlotLocation.top]: { modules: ['@opensumi/ide-menu-bar'] },
    [SlotLocation.action]: { modules: [''] },
    [SlotLocation.left]: { modules: ['@opensumi/ide-explorer', '@opensumi/ide-search'] },
    [SlotLocation.right]: { modules: [] },
    [SlotLocation.main]: { modules: ['@opensumi/ide-editor'] },
    [SlotLocation.bottom]: { modules: ['@opensumi/ide-output', '@opensumi/ide-markers'] },
    [SlotLocation.statusBar]: { modules: ['@opensumi/ide-status-bar'] },
    [SlotLocation.extra]: { modules: ['breadcrumb-menu'] },
  } as any,
  defaultPreferences: {
    'general.theme': 'opensumi-design-dark-theme',
    'editor.autoSave': 'afterDelay',
    'editor.autoSaveDelay': 1000,
  },
};

export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  workspace: {
    filesystem: {
      fs: 'OverlayFS',
      options: {
        writable: { fs: 'IndexedDB' },
        readable: {
          fs: 'DynamicRequest',
          options: {
            async readDirectory(p: string) {
              const entries = await fileClient.readDirectory(p);
              return toFileEntries(entries);
            },
            async readFile(p: string) {
              return fileClient.readFile(p);
            },
          },
        },
      },
    },
    async onDidSaveTextDocument({ filepath, content }) {
      try {
        await fileClient.writeFile(filepath, content);
      } catch (error) {
        console.error(`[洪荒] 写回 opencode 失败: ${filepath}`, error);
      }
    },
    async onDidCreateFiles(files: string[]) {
      await Promise.all(
        files.map(async (filepath) => {
          try {
            if (looksLikeFile(filepath)) {
              await fileClient.createFile(filepath);
            } else {
              await fileClient.createDirectory(filepath);
            }
          } catch (error) {
            console.error(`[洪荒] 新建写回失败: ${filepath}`, error);
          }
        })
      );
    },
    async onDidDeleteFiles(files: string[]) {
      await Promise.all(
        files.map(async (filepath) => {
          try {
            await fileClient.deletePath(filepath);
          } catch (error) {
            console.error(`[洪荒] 删除写回失败: ${filepath}`, error);
          }
        })
      );
    },
  },
};
