/**
 * login session API — 客户端登录状态读写 (跨 commands + webview 复用)
 *
 * 数据来源: 严格只从 localStorage 'taichu.login.session' 取
 *   - 不再兜底 __TAICHU_DEPLOY_CONFIG__: OAuth 登录完成由 writeSession 写 localStorage
 *   - 防止 stale session (如部署配置残留 userId) 误判已登录
 *   - runtime.ts readSession / login modules / 各扩展统一通过 taichu.session.* commands
 *     读取 (commands/login 注册), 不再各自 import 此函数硬编码判断
 *
 * 写入 (writeSession) 同时:
 *   - 写 localStorage
 *   - 写 window.__TAICHU_LOGIN_SESSION__
 *   - 触发 'taichu:login-session-changed' 事件
 *   - 重定向到 redirect_to_url (或 /)
 *
 * 清除 (clearSession) 同时:
 *   - 删 localStorage
 *   - 删 window.__TAICHU_LOGIN_SESSION__
 *   - 触发 'taichu:login-session-changed' 事件 (detail: null)
 *
 * 跨 commands/login + components/login + components/user 复用
 */

export interface LoginSession {
  username: string;
  userId: string;
  avatarUrl: string;
}

const STORAGE_KEY = 'taichu.login.session';

export function readSession(): LoginSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LoginSession;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeSession(session: LoginSession): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
  (window as any).__TAICHU_LOGIN_SESSION__ = session;
  window.dispatchEvent(
    new CustomEvent('taichu:login-session-changed', { detail: session })
  );
  const redirect = getRedirectTo();
  if (redirect && redirect !== '/' && redirect !== window.location.pathname) {
    setTimeout(() => {
      window.location.href = redirect;
    }, 0);
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  delete (window as any).__TAICHU_LOGIN_SESSION__;
  window.dispatchEvent(
    new CustomEvent('taichu:login-session-changed', { detail: null })
  );
}

function getGatewayUrl(): string {
  return (
    (window as any).__TAICHU_GATEWAY_URL__ ||
    (window as any).__TAICHU_DEPLOY_CONFIG__?.gatewayUrl ||
    'http://gateway.taichu.localhost'
  );
}

/**
 * 登出: 先销毁沙箱 runtime (gateway DELETE /runtime), 再清本地 session。
 *
 * 必须在清 session 前取 userId (DELETE 按 X-User-Id 定位 runtime);
 * 沙箱销毁失败不阻塞登出 (TTL 回收兜底), 静默忽略。
 */
export async function logout(): Promise<void> {
  const session = readSession();
  if (session?.userId) {
    try {
      await fetch(`${getGatewayUrl()}/runtime`, {
        method: 'DELETE',
        headers: { 'X-User-Id': session.userId },
      });
    } catch {
      /* 销毁失败不阻塞登出, gateway TTL 回收兜底 */
    }
  }
  clearSession();
}

export function getRedirectTo(): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('redirect_to_url') || '/';
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
}

/**
 * login 状态全局 API — 供 VSIX 或其他 client 拓展通过 window.__TAICHU_LOGIN_API__ 调用
 */
export function installLoginApi(): void {
  (window as any).__TAICHU_LOGIN_API__ = {
    getSession: readSession,
    setSession: writeSession,
    clearSession,
    getRedirectTo,
  };
}