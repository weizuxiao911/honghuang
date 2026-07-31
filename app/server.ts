/**
 * Taichu app 静态托管 + 配置注入 server.
 *
 * 设计文档第一章: app 纯前端容器, 不内置任何业务逻辑.
 * 本服务只做两件事:
 *   1. 静态托管 webpack 产物 (dist/)
 *   2. 渲染 index.html 时把 X_USER_ID / GATEWAY_URL 等注入 window.__TAICHU_DEPLOY_CONFIG__
 *      前端 bootstrap.ts 已设计为读取该全局变量 (见 src/config/bootstrap.ts)
 *
 * .env 文件约定:
 *   X_USER_ID   用户标识; 缺失时自动生成 UUID v4 并持久化回 .env
 *   X_TENANT_ID 租户标识; 缺省 default
 *
 * 环境变量覆盖:
 *   PORT          HTTP 监听端口 (default 8080)
 *   DIST_DIR      webpack 产物目录 (default dist)
 *   ENV_FILE      用户持久化文件路径 (default /etc/taichu/.env)
 *   GATEWAY_URL   gateway Ingress host (default http://gateway.taichu.localhost)
 *   RUNTIME_HOST_SUFFIX  sandbox 子域后缀 (default runtime.taichu.localhost)
 *   DEPLOY_ENV    dev | staging | prod
 */

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT) || 8080;
const DIST_DIR = process.env.DIST_DIR || path.resolve('dist');
const ENV_FILE = process.env.ENV_FILE || '/etc/taichu/.env';

const DEFAULT_CONFIG = {
  deployEnv: 'dev',
  gatewayUrl: 'http://gateway.taichu.localhost',
  runtimeHostSuffix: 'runtime.taichu.localhost',
  userId: '',
  tenantId: 'default',
};

function readEnvFile(): Record<string, string> {
  try {
    const raw = fs.readFileSync(ENV_FILE, 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1]) out[m[1]] = m[2] ?? '';
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

function ensureUserIdentity(): { userId: string; tenantId: string } {
  const env = readEnvFile();
  let userId = env.X_USER_ID;
  if (!userId) {
    userId = crypto.randomUUID();
    writeEnvFile({
      X_USER_ID: userId,
      X_TENANT_ID: env.X_TENANT_ID || DEFAULT_CONFIG.tenantId,
    });
    console.log(`[taichu-app] 生成新用户标识: ${userId}`);
  }
  return {
    userId,
    tenantId: env.X_TENANT_ID || DEFAULT_CONFIG.tenantId,
  };
}

const app = express();

app.get('/api/uid', (_req, res) => {
  const identity = ensureUserIdentity();
  res.json(identity);
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'UP', service: 'taichu-app' });
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
  if (req.path.startsWith('/api/')) {
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
  const identity = ensureUserIdentity();
  const cfg = {
    deployEnv: process.env.DEPLOY_ENV || DEFAULT_CONFIG.deployEnv,
    gatewayUrl: process.env.GATEWAY_URL || DEFAULT_CONFIG.gatewayUrl,
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