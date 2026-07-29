# extension-registry — vsix 统一管理与分发

> 职责（单一）：扫描 `vsix/` 目录里的 `.vsix` 包 → 解压 + 生成 CodeBlitz metadata → HTTP(S) 静态分发，供 opensumi-web 运行时 fetch 集成。
> 状态：**端到端跑通**（opensumi-web 运行时 fetch 清单 → kt-ext 加载 → 扩展激活 → 面板渲染 → 直连 opencode 新建会话）。

## 定位

三层职责分离中的**中间分发层**：

```
vsix 源码项目（各自维护）    →  产出 .vsix
        │ 投放 vsix/
        ▼
extension-registry（本项目）  →  扫描 → dist/<id>/ + dist/metadata.json → HTTPS 分发
        │ GET /metadata.json + /<id>/out/*.js
        ▼
opensumi-web（纯容器）        →  运行时 fetch 清单，动态集成
```

## 目录

```
extension-registry/
  vsix/                 # 固定目录：投放编译好的 .vsix（新增插件丢这里即可）
  src/
    build.ts            # 扫描 vsix → 解压 dist/<id>/ → 生成 dist/metadata.json
    server.ts           # HTTPS 静态分发 dist/（CORS 全放行）
  certs/                # 自签证书（kt-ext 强制 https，本地需要）
  dist/                 # 产物（gitignore）
```

## 用法

```bash
npm install

# 生成自签证书（首次，本地开发用；kt-ext 协议强制 https）
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem \
  -days 3650 -nodes -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
# 让浏览器信任（macOS，一次性）
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem

# 扫描 + 生成 metadata
npm run build

# 启动分发服务（https://localhost:9000）
npm run serve
```

投放新扩展：把 `.vsix` 丢进 `vsix/`，重跑 `npm run build`（server 实时读 `dist/`，无需重启）。

## 生成的 metadata 关键点（源码实测）

`dist/metadata.json` 是 `IExtensionBasicMetadata[]`，供 `appConfig.extensionMetadata` 消费。两个**必须正确**的字段：

1. **`mode: 'local'` + `uri`**：只有 `mode==='local' && uri` 时运行时才用本 `uri`；`'public'` 会走市场 CDN 路径拼接（实测请求被打到 `gw.alipayobjects.com` 而 404）。
2. **`contributes` 必须合并 `sumiContributes`**：运行时激活视图的判定是 `contributes.browserMain`（非 `sumiContributes.browserMain`）。故生成时把 `sumiContributes` 合并进 `contributes`（同名数组拼接），否则 browserMain/browserViews 不加载、面板不出现。

`uri` 格式：`kt-ext://<host>/<publisher.name-version>`。运行时 kt-ext 协议解析：
- 扩展资源（worker/browser 主文件）**强制 https**（`KtExtFsProviderContribution` 硬编码 `withScheme('https')`）。
- 故本地 registry 必须 https；生产 CDN/OSS 本就是 https，无此问题。

## 已知坑点（实测记录）

| 现象 | 根因 | 解法 |
|------|------|------|
| 扩展资源请求打到阿里云 CDN 404 | metadata `mode:'public'` | 改 `mode:'local'` 且带 `uri` |
| browserMain/views.js 不加载、面板不出现 | 运行时读 `contributes.browserMain`，未合并 sumiContributes | build 时 `mergeContributes` |
| `Cannot destructure 'useState' of React` | 宿主注入的全局是大写 `React`，扩展 `require('react')` 拿不到 | 扩展 `require('React')`，esbuild external `React` |
| `net::ERR_SSL_PROTOCOL_ERROR` / 证书不受信 | kt-ext 强制 https，本地自签 | 生成自签证书 + 钥匙串信任 |
| 活动栏图标不显示（面板仍在） | `icon: comment-discussion` 不在内置图标库 | 换内置图标名（待办） |

## 待验证

- [ ] 换用内置存在的活动栏图标（当前 `comment-discussion` 缺失，图标区空白但面板可点开）。
- [ ] 多 vsix 共存、版本升级时的清单与 IndexedDB 缓存策略。
- [ ] 生产 CDN/OSS 托管（https、CORS、缓存头），去掉本地自签证书环节。
