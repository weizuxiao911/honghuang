/**
 * login session API — 客户端登录状态读写
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
 *   - 重定向到 /auth/github/logout (server.ts 提供的登出)
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
  // 如果是从受限页面跳转来登录, redirect_to_url 携带原路径, 登录后回跳
  const redirect = getRedirectTo();
  if (redirect && redirect !== '/' && redirect !== window.location.pathname) {
    setTimeout(() => {
      window.location.href = redirect;
    }, 0);
  }
  // 默认情况: 已在 IDE 骨架内, 不重定向, 由 LoginLayout 监听 session-changed 自动隐藏
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
  // 走 server.ts 登出 (清 .env 中的 X_USER_ID)
  setTimeout(() => {
    window.location.href = '/auth/github/logout';
  }, 0);
}

export function getRedirectTo(): string {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('redirect_to_url') || '/';
  // 防开放重定向: 只接受相对路径
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
