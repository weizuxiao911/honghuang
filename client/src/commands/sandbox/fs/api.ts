/**
 * fs api 共享底层 — commands/fs
 *
 * 事件驱动: fs 不 import commands/opencode 的代码, 通过 window 事件 + 全局拿 SDK 实例:
 *   - 监听 'taichu:opencode-ready' 事件 (SDK 实例就绪, commands/opencode 派发)
 *   - 执行时从 window.__TAICHU_OPENCODE__ 读 SDK 实例 (不直接 import)
 *
 * 事件流:
 *   login 登录 → commands/opencode 拉 runtime → 创建 SDK 客户端 → 派发
 *   'taichu:opencode-ready' → fs 收到事件 → 自检 (bindFsSync)
 */

export function getFsClient() {
  return (window as any).__TAICHU_OPENCODE__ ?? null;
}

export function isFsReady(): boolean {
  return !!getFsClient();
}

export function assertFsReady(): void {
  if (!isFsReady()) {
    throw new Error('opencode client not ready (sandbox 未激活, 登录后会自动激活)');
  }
}

/**
 * 等待 SDK client 就绪 (沙箱激活 + opencode warmup 探活通过后才创建).
 * 刷新场景: 沙箱/SDK 重连期间调用 fsApi 不再立即抛错, 而是在 timeoutMs 内
 * 轮询等待; 超时仍抛错 (兜底, 调用方 catch 处理).
 */
export async function waitForFsReady(timeoutMs = 8000): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (isFsReady()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`opencode client not ready within ${timeoutMs}ms (sandbox 未激活)`);
}

/**
 * 监听 SDK 就绪事件 (opencode-ready), 回调里拿到 SDK 实例
 */
export function onOpencodeReady(handler: (client: any) => void): () => void {
  const onReady = () => {
    const client = getFsClient();
    if (client) handler(client);
  };
  window.addEventListener('taichu:opencode-ready', onReady);
  // 已就绪的情况直接触发
  onReady();
  return () => window.removeEventListener('taichu:opencode-ready', onReady);
}