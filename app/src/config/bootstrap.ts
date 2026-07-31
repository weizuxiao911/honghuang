import type { DeployEnv, RuntimeConfig } from './runtime';

interface BootstrapResponse {
  baseUrl: string;
  gatewayUrl: string;
  runtimeHostSuffix: string;
  runtimeId: string;
}

const DEV_GATEWAY = 'http://gateway.localhost';
const DEV_RUNTIME_SUFFIX = 'runtime.localhost';
const DEV_DEFAULT_TENANT = 'dev';
const DEV_DEFAULT_USER = 'dev';
const BOOTSTRAP_TIMEOUT_MS = 30_000;
const SANDBOX_READY_TIMEOUT_MS = 90_000;
const SANDBOX_READY_INTERVAL_MS = 1_000;

const config = (window as any).__TAICHU_DEPLOY_CONFIG__ as
  | { deployEnv?: DeployEnv; gatewayUrl?: string; runtimeHostSuffix?: string; userId?: string; tenantId?: string }
  | undefined;

const DEPLOY_ENV: DeployEnv = (config?.deployEnv as DeployEnv) || 'dev';
const GATEWAY_URL = config?.gatewayUrl || DEV_GATEWAY;
const RUNTIME_SUFFIX = config?.runtimeHostSuffix || DEV_RUNTIME_SUFFIX;
const USER_ID = config?.userId || DEV_DEFAULT_USER;
const TENANT_ID = config?.tenantId || DEV_DEFAULT_USER;

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
  return { baseUrl, gatewayUrl: GATEWAY_URL, runtimeHostSuffix: RUNTIME_SUFFIX, runtimeId };
}

async function waitForSandboxReady(baseUrl: string, signal: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + SANDBOX_READY_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    if (signal.aborted) return false;
    attempt++;
    try {
      const r = await fetch(`${baseUrl}/global/health`, {
        signal: AbortSignal.timeout(2000),
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const d = await r.json().catch(() => null);
        if (d?.healthy === true) {
          console.log(`[Taichu] sandbox ready after ${attempt}s (${baseUrl})`);
          return true;
        }
      }
    } catch {
      // 连接拒绝 / 超时，继续重试
    }
    await new Promise<void>((resolve) => setTimeout(resolve, SANDBOX_READY_INTERVAL_MS));
  }
  console.warn(`[Taichu] sandbox not ready after ${SANDBOX_READY_TIMEOUT_MS / 1000}s (${baseUrl})`);
  return false;
}

export async function resolveRuntime(onProgress?: (msg: string) => void): Promise<RuntimeConfig> {
  const controller = new AbortController();
  const outer = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS + SANDBOX_READY_TIMEOUT_MS);
  try {
    onProgress?.('创建运行时实例…');
    const data = await fetchBootstrap();

    onProgress?.('等待 sandbox 启动…');
    const ready = await waitForSandboxReady(data.baseUrl, controller.signal);

    return {
      baseUrl: data.baseUrl,
      gatewayUrl: data.gatewayUrl,
      runtimeHostSuffix: data.runtimeHostSuffix,
      userId: USER_ID,
      tenantId: TENANT_ID,
      runtimeId: data.runtimeId,
      ready,
    };
  } finally {
    clearTimeout(outer);
  }
}
