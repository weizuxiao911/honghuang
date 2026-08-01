import type { DeployEnv, RuntimeConfig } from './runtime';

interface BootstrapResponse {
  baseUrl: string;
  gatewayUrl: string;
  runtimeHostSuffix: string;
  runtimeId: string;
  status: string;
}

interface SseEvent {
  id?: string;
  type?: string;
  userId?: string;
  runtimeId?: string;
  status?: string;
  message?: string;
  timestamp?: string;
}

const DEV_GATEWAY = 'http://gateway.localhost';
const DEV_RUNTIME_SUFFIX = 'runtime.localhost';
const DEV_DEFAULT_TENANT = 'dev';
const DEV_DEFAULT_USER = 'dev';
const SSE_READY_TIMEOUT_MS = 120_000;

const config = (window as any).__TAICHU_DEPLOY_CONFIG__ as
  | { deployEnv?: DeployEnv; gatewayUrl?: string; runtimeHostSuffix?: string; userId?: string; tenantId?: string }
  | undefined;

const DEPLOY_ENV: DeployEnv = (config?.deployEnv as DeployEnv) || 'dev';
const GATEWAY_URL = config?.gatewayUrl || DEV_GATEWAY;
const RUNTIME_SUFFIX = config?.runtimeHostSuffix || DEV_RUNTIME_SUFFIX;
const USER_ID = config?.userId || DEV_DEFAULT_USER;
const TENANT_ID = config?.tenantId || DEV_DEFAULT_USER;

interface SseReady {
  runtimeId: string;
  status: string;
  source: 'reused' | 'created';
}

async function fetchBootstrap(): Promise<BootstrapResponse> {
  const r = await fetch(`${GATEWAY_URL}/runtime`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': USER_ID,
      'X-Tenant-Id': TENANT_ID,
      'X-Deploy-Env': DEPLOY_ENV,
    },
    body: JSON.stringify({ userId: USER_ID, tenantId: TENANT_ID }),
  });
  if (!r.ok) {
    throw new Error(`gateway /runtime failed: ${r.status} ${r.statusText}`);
  }
  const data = await r.json();
  const runtimeId: string = data.runtimeId || data.id;
  if (!runtimeId) {
    throw new Error('gateway /runtime response missing runtimeId');
  }
  const baseUrl = data.baseUrl || `http://${runtimeId}.${RUNTIME_SUFFIX}`;
  return { baseUrl, gatewayUrl: GATEWAY_URL, runtimeHostSuffix: RUNTIME_SUFFIX, runtimeId, status: (data.status || '').toLowerCase() };
}

/**
 * SSE 主导 bootstrap: 立即按 userId 订阅 SSE 事件流, 并行发起 POST /runtime.
 * 复用路径: SSE 立即推 INITIAL_STATE (status=ready), 秒级 resolve.
 * 新建路径: SSE 推 CREATED → SCHEDULED → READY, 8s 后 resolve.
 */
async function listenSseUntilReady(
  userId: string,
  onProgress?: (status: string, message: string) => void,
): Promise<SseReady> {
  const url = `${GATEWAY_URL}/runtime/events?userId=${encodeURIComponent(userId)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SSE_READY_TIMEOUT_MS);

  try {
    const r = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (!r.ok || !r.body) {
      throw new Error(`SSE connect failed: ${r.status} ${r.statusText}`);
    }
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buf.indexOf('\n\n')) !== -1) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const ev = parseSseEvent(raw);
        if (!ev) continue;
        if (ev.userId && ev.userId !== userId) continue;

        const status = (ev.status || '').toUpperCase();
        onProgress?.(status, ev.message || '');

        if (ev.type === 'FAILED' || status === 'FAILED') {
          throw new Error(`runtime 状态变更失败: ${ev.message || status}`);
        }

        if (ev.type === 'INITIAL_STATE' && status === 'READY' && ev.runtimeId) {
          // 复用路径: SSE 立即推 INITIAL_STATE (snapshot 已在 Redis)
          clearTimeout(timer);
          controller.abort();
          return { runtimeId: ev.runtimeId, status: 'ready', source: 'reused' };
        }

        if (status === 'READY' && ev.runtimeId) {
          // 新建路径: sandbox 启动完成
          clearTimeout(timer);
          controller.abort();
          return { runtimeId: ev.runtimeId, status: 'ready', source: 'created' };
        }
      }
    }
    throw new Error('SSE 流提前关闭');
  } finally {
    clearTimeout(timer);
    try { controller.abort(); } catch { /* noop */ }
  }
}

function parseSseEvent(block: string): SseEvent | null {
  let type: string | undefined;
  let id: string | undefined;
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith(':')) continue;
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('id:')) id = line.slice(3).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    const parsed = JSON.parse(data) as SseEvent;
    if (type && !parsed.type) parsed.type = type;
    if (id && !parsed.id) parsed.id = id;
    return parsed;
  } catch {
    return null;
  }
}

export async function resolveRuntime(onProgress?: (msg: string) => void): Promise<RuntimeConfig> {
  onProgress?.('初始化…');
  // SSE 立即连 (按 userId, 不等 runtimeId)
  const ssePromise = listenSseUntilReady(USER_ID, (status, message) =>
    onProgress?.(formatProgress(status, message)),
  ).catch((err) => ({ _error: err }));

  // POST 立即并行 (拿 runtimeId + 备用 snapshot)
  const postPromise = fetchBootstrap().catch((err) => ({ _error: err }));

  // 谁先到 (race): SSE 收 INITIAL_STATE/READY, 或 POST 返回
  const winner = await Promise.any([
    ssePromise,
    postPromise,
  ]) as (SseReady & { _error?: unknown }) | (BootstrapResponse & { _error?: unknown });

  // 处理 SSE 失败 (fallback 到 POST)
  if ('_error' in winner && !(winner as SseReady).runtimeId) {
    const post = (await postPromise) as BootstrapResponse & { _error?: unknown };
    if ('_error' in post) throw new Error('SSE 和 POST 都失败');
    return buildConfig(post);
  }

  // 决定 runtimeId
  let runtimeId: string;
  if ('source' in winner) {
    // SSE 先 resolve
    runtimeId = (winner as SseReady).runtimeId;
    if ('status' in winner && (winner as BootstrapResponse).status === 'pending') {
      // POST 是新建 (pending), 等 SSE READY
      const ev = (await ssePromise) as SseReady;
      runtimeId = ev.runtimeId;
    }
  } else {
    // POST 先 resolve
    const post = winner as BootstrapResponse;
    runtimeId = post.runtimeId;
    if (post.status !== 'ready') {
      // 新建路径, 等 SSE READY
      const ev = (await ssePromise) as SseReady;
      runtimeId = ev.runtimeId;
    }
  }

  return {
    baseUrl: `http://${runtimeId}.${RUNTIME_SUFFIX}`,
    gatewayUrl: GATEWAY_URL,
    runtimeHostSuffix: RUNTIME_SUFFIX,
    userId: USER_ID,
    tenantId: TENANT_ID,
    runtimeId,
    ready: true,
  };
}

function buildConfig(post: BootstrapResponse): RuntimeConfig {
  return {
    baseUrl: post.baseUrl,
    gatewayUrl: post.gatewayUrl,
    runtimeHostSuffix: post.runtimeHostSuffix,
    userId: USER_ID,
    tenantId: TENANT_ID,
    runtimeId: post.runtimeId,
    ready: true,
  };
}

function formatProgress(status: string, message: string): string {
  if (!status) return message || '连接平台事件流…';
  const label: Record<string, string> = {
    PENDING: '排队中',
    CREATING: '创建 Pod…',
    RUNNING: 'Pod 启动中',
    READY: 'sandbox 就绪',
    FAILED: '失败',
    TERMINATING: '清理中',
    TERMINATED: '已回收',
  };
  return `${label[status] || status}${message ? ` · ${message}` : ''}`;
}