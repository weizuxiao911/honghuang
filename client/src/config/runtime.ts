import type { IAppRendererProps } from '@codeblitzjs/ide-core';

/**
 * 运行时配置 — CodeBlitz runtimeConfig
 *
 * client 不接管任何文件系统客户端、不注入任何 window 全局;
 * filesystem 配置留空,让 CodeBlitz 走默认 in-memory / IndexedDB 实现。
 * 业务 IO 由 VSIX 通过窗口外工具(自己的 fetch / agent-image 直连)实现。
 */
export const runtimeConfig: IAppRendererProps['runtimeConfig'] = {
  workspace: {
    filesystem: {
      fs: 'OverlayFS',
      options: {
        writable: { fs: 'IndexedDB' },
        readable: { fs: 'DynamicRequest' },
      },
    },
  },
} as any;
