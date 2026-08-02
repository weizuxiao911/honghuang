/**
 * opencode runtime 拉取 — 沙箱 runtime 生命周期管理
 *
 * 流程:
 *   1. 监听 'taichu:login-session-changed' (LoginView 登录成功后派发)
 *   2. 已登录 → fetch `${gateway}/runtime` (POST) 创建 runtime
 *      Header: X-User-Id / X-Tenant-Id / X-Deploy-Env
 *   3. 拿到 RuntimeSnapshot → 缓存 RuntimeInfo + 写 window.__TAICHU_RUNTIME__
 *      baseUrl = snapshot.agentApiBase (e.g. http://<runtimeId>.runtime.taichu.localhost/agent/)
 *   4. 派发 'taichu:fs-ready' 事件, commands/opencode/client.ts 监听到
 *      创建 OpenCode SDK 客户端 (基于 baseUrl) + 挂 window.__TAICHU_OPENCODE__
 *
 * 登出 ('taichu:login-session-changed' 带 detail=null):
 *   - 清 runtime 缓存
 *   - 派发 'taichu:fs-teardown' (dispose SDK)
 *
 * 事件流:
 *   1. taichu:fs-loading (detail: { phase: 'fetching-runtime' }) — 开始 POST /runtime
 *   2. taichu:fs-ready   (detail: RuntimeInfo)                  — sandbox 就绪
 *   3. taichu:fs-error   (detail: Error)                        — 失败
 *   4. taichu:fs-teardown                                          — 登出
 */

export interface RuntimeInfo {
  userId: string;
  tenantId: string;
  deployEnv: string;
  runtimeId: string;
  baseUrl: string;
}

export class RuntimeError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string
  ) {
    super(message || `runtime ${status}: ${body?.slice(0, 200)}`);
    this.name = 'RuntimeError';
  }
}

interface LoginSession {
  username?: string;
  userId?: string;
  tenantId?: string;
  avatarUrl?: string;
}

interface RuntimeSnapshot {
  runtimeId: string;
  userId: string;
  internalUrl?: string;
  agentApiBase: string;
  status?: string;
  namespace?: string;
  deploymentName?: string;
  serviceName?: string;
}

declare const process: { env: Record<string, string | undefined> };

function getGatewayUrl(): string {
  return (
    process.env.GATEWAY_URL ||
    (window as any).__TAICHU_GATEWAY_URL__ ||
    'http://gateway.taichu.localhost'
  );
}

function getDeployEnv(): string {
  return (
    process.env.DEPLOY_ENV ||
    (window as any).__TAICHU_DEPLOY_ENV__ ||
    'development'
  );
}

let _runtime: RuntimeInfo | null = null;
let activated = false;

async function readSession(): Promise<LoginSession | null> {
  const cfg = (window as any).__TAICHU_DEPLOY_CONFIG__;
  if (cfg?.userId) {
    return {
      username: cfg.username,
      userId: cfg.userId,
      tenantId: cfg.tenantId,
      avatarUrl: cfg.avatarUrl,
    };
  }
  try {
    const raw = localStorage.getItem('taichu.login.session');
    if (raw) return JSON.parse(raw) as LoginSession;
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchRuntime(sess: LoginSession): Promise<RuntimeSnapshot> {
  const url = getGatewayUrl().replace(/\/$/, '') + '/runtime';
  const userId = sess.userId || '';
  const tenantId = sess.tenantId || userId;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
    'X-Tenant-Id': tenantId,
    'X-Deploy-Env': getDeployEnv(),
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  if (!resp.ok) {
    if (resp.status === 409 || resp.status === 200) {
      // 409 conflict = already exists, 调 GET /runtime 拿现有 snapshot
      const getResp = await fetch(url, {
        method: 'GET',
        headers: { ...headers },
      });
      if (getResp.ok) return (await getResp.json()) as RuntimeSnapshot;
    }
    const text = await resp.text().catch(() => '');
    throw new RuntimeError(resp.status, text, `fetchRuntime ${resp.status}`);
  }
  return (await resp.json()) as RuntimeSnapshot;
}

/**
 * 激活沙箱 runtime: 创建/获取 RuntimeSnapshot, 缓存 RuntimeInfo
 */
export async function activateRuntime(): Promise<RuntimeInfo | null> {
  const sess = await readSession();
  if (!sess?.userId) {
    console.warn('[opencode] activateRuntime: no login session, skip');
    return null;
  }
  window.dispatchEvent(
    new CustomEvent('taichu:fs-loading', {
      detail: { phase: 'fetching-runtime' },
    })
  );
  try {
    const snap = await fetchRuntime(sess);
    const info: RuntimeInfo = {
      userId: sess.userId,
      tenantId: sess.tenantId || sess.userId,
      deployEnv: getDeployEnv(),
      runtimeId: snap.runtimeId,
      baseUrl: snap.agentApiBase,
    };
    _runtime = info;
    (window as any).__TAICHU_RUNTIME__ = snap;
    activated = true;
    window.dispatchEvent(new CustomEvent('taichu:fs-ready', { detail: info }));
    console.info('[opencode] runtime activated:', info.runtimeId, info.baseUrl);
    return info;
  } catch (err) {
    console.error('[opencode] activateRuntime failed:', err);
    window.dispatchEvent(new CustomEvent('taichu:fs-error', { detail: err }));
    return null;
  }
}

export function teardownRuntime(): void {
  _runtime = null;
  delete (window as any).__TAICHU_RUNTIME__;
  if (activated) {
    activated = false;
    window.dispatchEvent(new CustomEvent('taichu:fs-teardown'));
  }
}

export function getRuntime(): RuntimeInfo | null {
  return _runtime;
}

export function isRuntimeReady(): boolean {
  return !!_runtime?.baseUrl;
}

/**
 * 监听登录态变化, 自动激活/卸载 sandbox runtime
 */
export function installRuntimeAutoActivate(): () => void {
  const onSessionChange = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && (detail as LoginSession).userId) {
      void activateRuntime();
    } else {
      teardownRuntime();
    }
  };
  window.addEventListener('taichu:login-session-changed', onSessionChange);
  // 首次挂载: 如果已登录, 主动激活
  void readSession().then((sess) => {
    if (sess?.userId) void activateRuntime();
  });
  return () => window.removeEventListener('taichu:login-session-changed', onSessionChange);
}