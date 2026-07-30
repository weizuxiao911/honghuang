import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VSIX_DIR = path.join(ROOT, 'vsix');
const DIST_DIR = path.join(ROOT, 'dist');

// 分发主机地址：opensumi-web 运行时按 kt-ext -> http/https 拉取扩展资源。
const PUBLIC_HOST = process.env.PUBLIC_HOST || 'localhost:9000';

// package.json 中被运行时消费的字段（与 CodeBlitz 扫描逻辑一致）。
// `main` 用于标准 VSCode 扩展（Node.js 入口），`browser` 用于 web/opensumi 扩展；
// CodeBlitz 需要两者都可用才能正确激活 customEditor / commands 等原生 VSCode 契约扩展。
const PICK_FIELDS = [
  'name',
  'publisher',
  'version',
  'engines',
  'categories',
  'repository',
  'displayName',
  'description',
  'icon',
  'activationEvents',
  'sumiContributes',
  'contributes',
  'main',
  'browser',
] as const;

interface PackageJSON {
  name: string;
  publisher: string;
  version: string;
  sumiContributes?: unknown;
  kaitianContributes?: unknown;
  [key: string]: unknown;
}

interface ExtensionMetadata {
  extension: { publisher: string; name: string; version: string };
  packageJSON: Record<string, unknown>;
  defaultPkgNlsJSON: Record<string, unknown>;
  pkgNlsJSON: Record<string, unknown>;
  nlsList: unknown[];
  extendConfig: Record<string, unknown>;
  webAssets: string[];
  mode: string;
  uri: string;
}

function pick(obj: PackageJSON, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    if (obj[f] !== undefined) out[f] = obj[f];
  }
  return out;
}

// 合并 sumiContributes 到 contributes：运行时按 contributes.browserMain/browserViews 激活视图
// （源码 activeExtensionContributes 判定条件），故必须把 sumiContributes 的键并入 contributes。
// 与 @opensumi/ide-extension 的 mergeContributes 语义一致：同名数组拼接，其余键并入。
function mergeContributes(
  contributes: Record<string, unknown> = {},
  sumiContributes: Record<string, unknown> = {}
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...sumiContributes };
  for (const [key, value] of Object.entries(contributes)) {
    const existing = result[key];
    if (Array.isArray(existing) && Array.isArray(value)) {
      result[key] = [...existing, ...value];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function rmrf(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function unpack(zip: AdmZip, id: string): void {
  const target = path.join(DIST_DIR, id);
  rmrf(target);
  for (const entry of zip.getEntries()) {
    if (entry.entryName.startsWith('extension/') && !entry.isDirectory) {
      const rel = entry.entryName.slice('extension/'.length);
      const dest = path.join(target, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.getData());
    }
  }
}

function buildMetadata(pkg: PackageJSON, id: string): ExtensionMetadata {
  // sumiContributes 兜底：老扩展可能用 kaitianContributes。
  const packageJSON = pick(pkg, PICK_FIELDS);
  const sumiContributes = (packageJSON.sumiContributes ?? pkg.kaitianContributes) as
    | Record<string, unknown>
    | undefined;
  if (sumiContributes) {
    packageJSON.sumiContributes = sumiContributes;
    // 关键：把 sumiContributes 合并进 contributes，运行时才会激活 browserMain/browserViews。
    packageJSON.contributes = mergeContributes(
      packageJSON.contributes as Record<string, unknown> | undefined,
      sumiContributes
    );
  }
  // CodeBlitz 是纯浏览器运行时，没有 Node 后端进程；标准 VSCode 扩展的 `main`
  // 只在 Node 进程加载，浏览器只会走 `browser` 字段。若扩展只声明 `main` 而未声明 `browser`，
  // 我们将其别名到 `browser`，让 activationEvent 能在 web worker 内触发扩展入口。
  // 前提：扩展代码仅使用 vscode API + webview API + 纯 JS 依赖（无 fs/net/node builtins）。
  if (typeof packageJSON.main === 'string' && !packageJSON.browser) {
    packageJSON.browser = packageJSON.main;
  }
  return {
    extension: { publisher: pkg.publisher, name: pkg.name, version: pkg.version },
    packageJSON,
    defaultPkgNlsJSON: {},
    pkgNlsJSON: {},
    nlsList: [],
    extendConfig: {},
    webAssets: [],
    // local 模式 + uri：运行时直接用本 uri 作扩展根，不走市场 CDN 路径拼接。
    mode: 'local',
    // kt-ext 协议：运行时按当前页面协议 fetch，指向本 registry 静态分发目录。
    uri: `kt-ext://${PUBLIC_HOST}/${id}`,
  };
}

function main(): void {
  if (!fs.existsSync(VSIX_DIR)) {
    console.error(`缺少 vsix 目录: ${VSIX_DIR}`);
    process.exit(1);
  }
  rmrf(DIST_DIR);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const vsixFiles = fs.readdirSync(VSIX_DIR).filter((f) => f.endsWith('.vsix'));
  const all: ExtensionMetadata[] = [];

  for (const file of vsixFiles) {
    const zip = new AdmZip(path.join(VSIX_DIR, file));
    const pkgEntry = zip.getEntry('extension/package.json');
    if (!pkgEntry) {
      console.warn(`跳过 ${file}: 缺少 extension/package.json`);
      continue;
    }
    const pkg: PackageJSON = JSON.parse(pkgEntry.getData().toString('utf8'));
    const id = `${pkg.publisher}.${pkg.name}-${pkg.version}`;
    unpack(zip, id);
    all.push(buildMetadata(pkg, id));
    console.log(`✓ ${id}`);
  }

  fs.writeFileSync(path.join(DIST_DIR, 'metadata.json'), JSON.stringify(all, null, 2));
  console.log(`→ dist/metadata.json (${all.length} 个扩展)`);
}

main();
