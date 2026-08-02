/**
 * login session API — 客户端登录状态读写 (跨 commands + webview 复用)
 *
 * 数据来源优先级:
 *   1. window.__TAICHU_DEPLOY_CONFIG__.userId (server.ts 注入, OAuth 登录后)
 *   2. localStorage 'taichu.login.session' (Mock 登录或 OAuth 同步副本)
 *   3. 都没有 → 未登录
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
 *   - 触发 'taichu:login-session-changed' 事件
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
  const cfg = (window as any).__TAICHU_DEPLOY_CONFIG__;
  if (cfg?.userId) {
    return {
      username: cfg.username || cfg.userId,
      userId: cfg.userId,
      avatarUrl: cfg.avatarUrl || '',
    };
  }
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