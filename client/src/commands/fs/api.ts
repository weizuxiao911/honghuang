/**
 * fs api 共享底层 — commands/fs
 *
 * 前置: opencode SDK 实例 (commands/opencode) 已创建 (登录后 POST /runtime → fs-ready).
 * 文件 IO 全部走 SDK client (不直连 HTTP):
 *   - 列目录 / 读文件 / 写文件 / 搜索 都通过 PTY 终端 (client.pty.*)
 *   - 原因: OpenCode v1.18.10 服务端 /file /find/file 有参数解析 bug
 *     (spec 定义了但实现报 Missing key), PTY 是实测可用的唯一通道
 */

import { getOpencodeClient, isOpencodeReady } from '../opencode/client';

export function getFsClient() {
  return getOpencodeClient();
}

export function isFsReady(): boolean {
  return isOpencodeReady();
}

export function assertFsReady(): void {
  if (!isFsReady()) {
    throw new Error('opencode client not ready (sandbox 未激活, 登录后会自动激活)');
  }
}