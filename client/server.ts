/**
 * Taichu app 静态托管 + GitHub OAuth 登录 + 配置注入 server.
 *
 * 设计文档第一章: app 纯前端容器, 不内置任何业务逻辑.
 * 本服务负责:
 *   1. 静态托管 webpack 产物 (dist/)
 *   2. GitHub OAuth 登录 (替换之前的随机 UUID 逻辑):
 *      GET /auth/github/login     跳转到 GitHub authorize
 *      GET /auth/github/callback  拿 code → 换 access_token → 拿 user.id
 *                                 → 写 X_USER_ID 到 .env → 302 回首页
 *   3. 渲染 index.html 时把 X_USER_ID / GATEWAY_URL / REGISTRY_URL 等注入 window.__TAICHU_DEPLOY_CONFIG__
 *      前端 bootstrap.ts 已设计为读取该全局变量 (见 src/config/bootstrap.ts)
 *
 * .env 文件约定 (hostpath mounted 到 /etc/taichu):
 *   GITHUB_CLIENT_ID      GitHub OAuth App Client ID
 *   GITHUB_CLIENT_SECRET  GitHub OAuth App Client Secret (不入库, 仅 hostpath)
 *   GITHUB_CALLBACK_URL   OAuth 回调地址 (default http://${host}/auth/github/callback)
 *   X_USER_ID             GitHub user.id (OAuth 回调后写入)
 *   X_TENANT_ID           租户标识 (缺省 default)
 *
 * 环境变量覆盖 (按 .env.{DEPLOY_ENV} 维护):
 *   PORT                 HTTP 监听端口 (default 8080)
 *   DIST_DIR             webpack 产物目录 (default dist)
 *   ENV_FILE             用户持久化文件路径 (default /etc/taichu/.env)
 *   DEPLOY_ENV           dev | staging | prod (default dev)
 *   GATEWAY_URL          gateway Ingress host (default http://gateway.taichu.localhost)
 *   REGISTRY_URL         registry 拓展市场 host (default http://registry.taichu.localhost)
 *   RUNTIME_HOST_SUFFIX  sandbox 子域后缀 (default runtime.taichu.localhost)
 */

import 'dotenv/config';
import { config as dotenvConfig } from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const DEPLOY_ENV = process.env.DEPLOY_ENV || 'dev';
dotenvConfig({ path: `.env.${DEPLOY_ENV}` });

const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = process.env.DIST_DIR || path.resolve('dist');
const ENV_FILE = process.env.ENV_FILE || '/etc/taichu/.env';

const DEFAULT_CONFIG = {
  deployEnv: DEPLOY_ENV,
  gatewayUrl: process.env.GATEWAY_URL || 'http://gateway.taichu.localhost',
  registryUrl: process.env.REGISTRY_URL || 'http://registry.taichu.localhost',
  runtimeHostSuffix: process.env.RUNTIME_HOST_SUFFIX || 'runtime.taichu.localhost',
  userId: '',
  tenantId: 'default',
};

function readEnvFile(): Record<string, string> {
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] && !m[1].startsWith('#')) out[m[1]] = m[2] ?? '';
    }
    return out;
  } catch {
    return {};
  }
}

function writeEnvFile(values: Record<string, string>): void {
  try {
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true });
    const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n');
  } catch (e) {
    console.warn(`[taichu-app] 写入 ${ENV_FILE} 失败:`, e);
  }
}

function getIdentity(): { userId: string; tenantId: string } {
  const env = readEnvFile();
  return {
    userId: env.X_USER_ID || '',
    tenantId: env.X_TENANT_ID || DEFAULT_CONFIG.tenantId,
  };
}

const app = express();

app.get('/api/uid', (_req, res) => {
  const identity = getIdentity();
  res.json(identity);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'UP', service: 'taichu-app' });
});

// ===== GitHub OAuth 路由 =====

/**
 * GET /auth/github/login
 * 302 跳转到 GitHub OAuth authorize endpoint.
 * 未登录状态 (X_USER_ID 空) 时自动触发, 登录成功后写 X_USER_ID 到 .env.
 */
app.get('/auth/github/login', (req, res) => {
  const env = readEnvFile();
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(500).type('text/plain').send(
      `GITHUB_CLIENT_ID 未配置 (检查 ${ENV_FILE})`,
    );
    return;
  }
  const callbackUrl =
    env.GITHUB_CALLBACK_URL ||
    `http://${req.headers.host}/auth/github/callback`;
  // CSRF state token (单次使用)
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 600_000,
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user',
    state,
  });
  console.log(`[taichu-auth] GitHub OAuth login -> ${callbackUrl}`);
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * GET /auth/github/callback?code=...&state=...
 * GitHub OAuth 回调: 拿 code 换 access_token, 再拿 GitHub user.id,
 * 写入 X_USER_ID 到 .env, 重定向回首页.
 */
app.get('/auth/github/callback', async (req, res) => {
  const env = readEnvFile();
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const callbackUrl =
    env.GITHUB_CALLBACK_URL ||
    `http://${req.headers.host}/auth/github/callback`;

  if (!clientId || !clientSecret) {
    res.status(500).type('text/plain').send(
      `OAuth 未配置 (GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET)`,
    );
    return;
  }

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const errorParam = typeof req.query.error === 'string' ? req.query.error : '';
  if (errorParam) {
    console.warn(`[taichu-auth] GitHub OAuth 错误: ${errorParam}`);
    res.status(400).type('text/plain').send(`OAuth 错误: ${errorParam}`);
    return;
  }
  if (!code) {
    res.status(400).type('text/plain').send('Missing code parameter');
    return;
  }

  try {
    // 1) 换 access_token
    const tokenResp = await fetch(
      'https://github.com/login/oauth/access_token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: callbackUrl,
        }),
      },
    );
    const tokenData = (await tokenResp.json()) as {
      access_token?: string;
      scope?: string;
      token_type?: string;
      error?: string;
    };
    if (!tokenData.access_token) {
      console.error('[taichu-auth] token 交换失败:', tokenData);
      res
        .status(400)
        .type('text/plain')
        .send(`Token 交换失败: ${tokenData.error || 'unknown'}`);
      return;
    }

    // 2) 拿 GitHub user (用 user.id 数字, 永久稳定)
    const userResp = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'taichu-app',
      },
    });
    if (!userResp.ok) {
      const errText = await userResp.text();
      console.error('[taichu-auth] /user 失败:', userResp.status, errText);
      res
        .status(502)
        .type('text/plain')
        .send(`GitHub /user 失败: ${userResp.status}`);
      return;
    }
    const user = (await userResp.json()) as { id: number; login: string };

    // 3) 持久化 X_USER_ID (= GitHub user.id) 到 .env
    writeEnvFile({
      GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID || '',
      GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET || '',
      GITHUB_CALLBACK_URL: env.GITHUB_CALLBACK_URL || '',
      X_USER_ID: String(user.id),
      X_TENANT_ID: env.X_TENANT_ID || 'default',
    });
    console.log(
      `[taichu-auth] GitHub 登录成功: user.id=${user.id} login=${user.login}`,
    );

    // 4) 重定向回首页
    res.clearCookie('oauth_state');
    res.redirect('/');
  } catch (err) {
    console.error('[taichu-auth] OAuth callback 异常:', err);
    res.status(500).type('text/plain').send(`OAuth 异常: ${(err as Error).message}`);
  }
});

/**
 * GET /auth/github/logout (可选)
 * 清空 X_USER_ID, 下次访问会重新走 OAuth 流程.
 */
app.get('/auth/github/logout', (_req, res) => {
  const env = readEnvFile();
  writeEnvFile({
    GITHUB_CLIENT_ID: env.GITHUB_CLIENT_ID || '',
    GITHUB_CLIENT_SECRET: env.GITHUB_CLIENT_SECRET || '',
    GITHUB_CALLBACK_URL: env.GITHUB_CALLBACK_URL || '',
    X_USER_ID: '',
    X_TENANT_ID: env.X_TENANT_ID || 'default',
  });
  console.log('[taichu-auth] 已登出');
  res.redirect('/auth/github/login');
});

// ===== 静态托管 + 配置注入 =====

app.get('/api/health', (_req, res) => {
  res.json({ status: 'UP', service: 'taichu-app' });
});

/**
 * GET /: 未登录则 302 到 OAuth login, 已登录则渲染 app.
 */
app.get('/', (req, res, next) => {
  const env = readEnvFile();
  if (!env.X_USER_ID && env.GITHUB_CLIENT_ID) {
    res.redirect('/auth/github/login');
    return;
  }
  next();
});

app.use(
  express.static(DIST_DIR, {
    index: false,
    fallthrough: true,
    setHeaders(res, file) {
      if (file.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
    },
  }),
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/')) {
    next();
    return;
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) {
    res.status(500).type('text/plain').send(
      `dist/index.html 不存在 (${indexPath}); 请先在构建阶段执行 npm run build`,
    );
    return;
  }
  const identity = getIdentity();
  const cfg = {
    deployEnv: DEPLOY_ENV,
    gatewayUrl: process.env.GATEWAY_URL || DEFAULT_CONFIG.gatewayUrl,
    registryUrl: process.env.REGISTRY_URL || DEFAULT_CONFIG.registryUrl,
    runtimeHostSuffix:
      process.env.RUNTIME_HOST_SUFFIX || DEFAULT_CONFIG.runtimeHostSuffix,
    userId: identity.userId,
    tenantId: identity.tenantId,
  };
  const html = fs.readFileSync(indexPath, 'utf8');
  const inject = `<script>window.__TAICHU_DEPLOY_CONFIG__ = ${JSON.stringify(cfg)};</script>`;
  const out = html.includes('</head>')
    ? html.replace('</head>', `${inject}</head>`)
    : `${inject}${html}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(out);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[taichu-app] listening on :${PORT}, dist=${DIST_DIR}, env=${ENV_FILE}`);
});