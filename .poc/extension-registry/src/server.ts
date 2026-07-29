import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(__dirname, '..', 'dist');
const CERT_DIR = path.resolve(__dirname, '..', 'certs');

const PORT = Number(process.env.PORT || 9000);

const MIME: Record<string, string> = {
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function send(res: http.ServerResponse, status: number, body: string | Buffer, type = 'text/plain'): void {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  });
  res.end(body);
}

const handler = (req: http.IncomingMessage, res: http.ServerResponse): void => {
  if (req.method === 'OPTIONS') {
    send(res, 204, '');
    return;
  }

  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  // 防目录穿越：解析后必须仍在 DIST_DIR 内。
  const filePath = path.normalize(path.join(DIST_DIR, urlPath));
  if (!filePath.startsWith(DIST_DIR)) {
    send(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, 'Not Found');
      return;
    }
    const type = MIME[path.extname(filePath)] || 'application/octet-stream';
    send(res, 200, fs.readFileSync(filePath), type);
  });
};

// CodeBlitz kt-ext 协议加载扩展资源时强制 https，故 registry 优先以 https 提供服务
// （证书存在时）；证书缺失则回退 http（仅 metadata.json 等非扩展资源可用）。
const keyPath = path.join(CERT_DIR, 'key.pem');
const certPath = path.join(CERT_DIR, 'cert.pem');
const useHttps = fs.existsSync(keyPath) && fs.existsSync(certPath);

const server = useHttps
  ? https.createServer({ key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) }, handler)
  : http.createServer(handler);

const scheme = useHttps ? 'https' : 'http';
server.listen(PORT, () => {
  console.log(`extension-registry 分发服务: ${scheme}://localhost:${PORT}`);
  console.log(`清单: ${scheme}://localhost:${PORT}/metadata.json`);
});
