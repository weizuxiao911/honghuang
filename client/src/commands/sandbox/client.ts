/**
 * OpenCode SDK 客户端封装 — commands/opencode/
 *
 * 沙箱接入单一入口: VSIX 与 client 内置拓展 (commands/fs, future ai-panel) 全部
 * 通过 @opencode-ai/sdk 访问沙箱 (v1 协议, 沙箱内 OpenCode 服务用 v1 端点),
 * 不直接 fetch /file /pty 等 HTTP 端点 (绕过 SDK 会丢失 Accept 头 / CORS /
 * query 编码 / WebSocket 升级等必要协议处理).
 *
 * 暴露:
 *   - 懒初始化 SDK 客户端 (基于 runtimeInfo.baseUrl)
 *   - window.__TAICHU_OPENCODE__ 全局访问点 (VSIX 直接拿 SDK 实例)
 *   - installOpencodeClient() 钩子: 监听 taichu:fs-ready 自动创建 + 暴露
 *
 * 生命周期:
 *   - taichu:fs-ready (baseUrl 就绪) → createOpencodeClient(baseUrl) + 挂全局
 *   - taichu:fs-teardown (登出/runtime 失效) → 清全局
 *   - workspace 变化 → 重建 SDK 实例 (baseUrl 变化时)
 */

import { createOpencodeClient, type OpencodeClient } from '@opencode-ai/sdk/v2/client';

import { getRuntime, type RuntimeInfo } from './runtime';

let _client: OpencodeClient | null = null;
let _baseUrl: string | null = null;
let _installHandlersAttached = false;
let warmupInFlight = false;

/**
 * 探活 OpenCode 服务 — Pod Running 不代表进程内 OpenCode HTTP 已起来,
 * 这里轮询 config 端点 (GET /config, 轻量) 直到成功, 最多 30s.
 */
async function warmupOpenCode(client: OpencodeClient, apiBase: string): Promise<boolean> {
  const url = apiBase.replace(/\/$/, '') + '/config';
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch {
      /* network error → retry */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/**
 * 懒初始化 OpenCode SDK 客户端 — 第一次调用时基于当前 baseUrl 创建,
 * 后续调用若 baseUrl 未变则返回缓存实例, 变了则替换旧的 + 创建新的.
 *
 * 注意: 不加任何自定义鉴权 header. OpenCode 服务 (sandbox 内部) 不识别
 * gateway 的 X-User-Id / X-Tenant-Id 等; 鉴权由 gateway 反代层处理 (CORS
 * Access-Control-Allow-Headers 不含这些, 加了会触发 preflight 拒绝).
 */
export function getOpencodeClient(): OpencodeClient | null {
  const runtime = getRuntime();
  if (!runtime?.baseUrl) return null;

  if (_client && _baseUrl === runtime.baseUrl) {
    return _client;
  }

  // baseUrl 变化 (rare) — 让旧 client GC (v1 SDK 无 dispose API)
  if (_client && _baseUrl && _baseUrl !== runtime.baseUrl) {
    _client = null;
  }

  _baseUrl = runtime.baseUrl;
  // 与重置前实现保持一致: baseUrl 直接用 gateway 返回的地址 (无 /agent/ 后缀),
  // v2 client, 不加自定义 headers (OpenCode 服务不识别 gateway 鉴权头).
  const apiBase = runtime.baseUrl.replace(/\/agent\/?$/, '');
  _client = createOpencodeClient({
    baseUrl: apiBase,
    responseStyle: 'fields',
    throwOnError: true,
  });
  // 挂到 window 全局
  (window as any).__TAICHU_OPENCODE__ = _client;
  (window as any).__TAICHU_OPENCODE_RUNTIME__ = runtime;
  return _client;
}

export function isOpencodeReady(): boolean {
  return getOpencodeClient() !== null;
}

export function disposeOpencodeClient(): void {
  _client = null;
  _baseUrl = null;
  delete (window as any).__TAICHU_OPENCODE__;
  delete (window as any).__TAICHU_OPENCODE_RUNTIME__;
}

/**
 * 安装 OpenCode SDK 监听 — 在 App 启动时调一次:
 *   - taichu:fs-ready  → 创建 SDK 客户端 → 探活 OpenCode 服务 → 派发 taichu:opencode-ready
 *   - taichu:fs-teardown → dispose SDK
 *
 * 关键: 沙箱 Pod Ready 不代表容器内 OpenCode 进程 HTTP 已监听,
 * 必须先轮询 GET /config 探活成功后再派发 ready, 否则后续
 * session.create / agent.list 等会 500.
 */
export function installOpencodeClient(): () => void {
  if (_installHandlersAttached) {
    return () => {};
  }
  _installHandlersAttached = true;

  const onReady = async () => {
    if (warmupInFlight) return;
    warmupInFlight = true;
    try {
      const client = getOpencodeClient();
      if (!client) return;
      const apiBase = (_baseUrl || '').replace(/\/agent\/?$/, '');
      const ok = await warmupOpenCode(client, apiBase);
      if (!ok) {
        console.warn('[opencode] warmup timeout after 30s, dispatching ready anyway');
      }
      window.dispatchEvent(new CustomEvent('taichu:opencode-ready'));
      // 沙箱加载完成 (opencode 探活通过, SDK 可访问) — 业务拓展 (assistant 等) 监听此事件
      window.dispatchEvent(new CustomEvent('taichu:sandbox-ready'));
    } finally {
      warmupInFlight = false;
    }
  };
  const onTeardown = () => {
    disposeOpencodeClient();
  };

  window.addEventListener('taichu:fs-ready', onReady as EventListener);
  window.addEventListener('taichu:fs-teardown', onTeardown);

  return () => {
    window.removeEventListener('taichu:fs-ready', onReady as EventListener);
    window.removeEventListener('taichu:fs-teardown', onTeardown);
    _installHandlersAttached = false;
  };
}

// 保留 RuntimeInfo 引用(其他文件可能用到)
export type { RuntimeInfo };