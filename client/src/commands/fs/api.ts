/**
 * fs fetch 封装 + RuntimeInfo 缓存 — fs IO 命令的共用底层
 *
 * 三个层次的封装:
 *
 *   1. 运行时信息 (RuntimeInfo): userId/tenantId/deployEnv/runtimeId/baseUrl
 *      - 来自 gateway POST /runtime 创建后返回的 RuntimeSnapshot
 *      - 由 components/layout/fs/runtime.ts 管理, 本文件只读
 *
 *   2. fsFetch(method, path, opts): 统一 fetch 封装
 *      - 路径: 沙箱内文件路径 (e.g. "/workspace/foo.txt")
 *      - 自动注入 Header: X-User-Id / X-Tenant-Id / X-Deploy-Env / X-Runtime-Id
 *      - 抛错: 非 2xx 抛 FSError (含 status + body)
 *
 *   3. FSError: 自定义错误类, 携带 HTTP status + body 文本
 *
 * 跨 commands/fs + components/layout/fs (provider 实现) 复用
 */

export interface RuntimeInfo {
  userId: string;
  tenantId: string;
  deployEnv: string;
  runtimeId: string;
  baseUrl: string;
}

export class FSError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    message?: string
  ) {
    super(message || `fs API ${status}: ${body?.slice(0, 200)}`);
    this.name = 'FSError';
  }
}

let _runtime: RuntimeInfo | null = null;

export function setRuntime(info: RuntimeInfo | null): void {
  _runtime = info;
}

export function getRuntime(): RuntimeInfo | null {
  return _runtime;
}

export function isRuntimeReady(): boolean {
  return !!_runtime?.baseUrl;
}

function requireRuntime(): RuntimeInfo {
  if (!_runtime) {
    throw new FSError(0, '', 'fs runtime not ready (login 后会自动激活)');
  }
  return _runtime;
}

export async function fsFetch<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  opts: {
    params?: Record<string, string>;
    body?: any;
    raw?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<T> {
  const runtime = requireRuntime();
  const url = new URL(runtime.baseUrl.replace(/\/$/, '') + path);

  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    'X-User-Id': runtime.userId,
    'X-Tenant-Id': runtime.tenantId,
    'X-Deploy-Env': runtime.deployEnv,
    'X-Runtime-Id': runtime.runtimeId,
  };

  let body: BodyInit | undefined;
  if (opts.body !== undefined) {
    if (opts.body instanceof FormData || opts.body instanceof Blob || typeof opts.body === 'string') {
      body = opts.body as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(opts.body);
    }
  }

  const ctl = new AbortController();
  const timer = opts.timeoutMs
    ? setTimeout(() => ctl.abort(), opts.timeoutMs)
    : null;
  try {
    const resp = await fetch(url.toString(), {
      method,
      headers,
      body,
      signal: ctl.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new FSError(resp.status, text);
    }
    if (opts.raw) {
      return (resp as any) as T;
    }
    const ct = resp.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return (await resp.json()) as T;
    }
    return (await resp.text()) as unknown as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 把 Uint8Array 转成 base64, 用于 PTY shell 写文件:
 *   printf %s "<base64>" | base64 -d > <path>
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  if (typeof btoa !== 'undefined') return btoa(bin);
  return Buffer.from(bin, 'binary').toString('base64');
}