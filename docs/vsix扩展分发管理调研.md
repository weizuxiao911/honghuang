# vsix 扩展分发管理调研（CodeBlitz 纯前端）

> 状态：**事实调研完成 + 端到端跑通**（`@codeblitzjs/ide-*` 2.4.6 源码 + 浏览器实测：registry 分发 → 运行时集成 → 面板激活 → 直连 opencode）
> 目标：厘清自研 vsix 在 CodeBlitz 纯前端容器中的**分发与集成链路**——metadata 生成、资源托管、运行时加载、版本与清单管理。
> 原则：**以实测/源码为准，不臆断**。推测项明确标注「待验证」。
> 关联：《vsix扩展开发标准调研.md》、《poc/extension-registry》、《poc/opensumi-web》。

---

## 1. 结论摘要

- ✅ **纯前端无文件系统扫描**，CodeBlitz 采用**声明式元数据加载**：`appConfig.extensionMetadata: IExtensionBasicMetadata[]`。
- ✅ **metadata 生成是构建期行为**（Node 环境），运行时只消费生成好的 JSON。生成可用 CodeBlitz CLI 的 `getExtension()`，或按已知结构自实现（结构简单，字段确定）。
- ✅ **资源加载走 `kt-ext` 协议**：metadata 的 `uri` 用 `kt-ext://host/path`，运行时按当前页面协议（http/https）`fetch` 拉取 browser/worker 资源。
- ✅ **集成可运行时动态化**：`extensionMetadata` 是 `<AppRenderer>` 的普通 props，可先 `fetch` 清单再渲染，容器**构建期无需知道有哪些 vsix**。
- ✅ **三层职责分离**（AgentNest 方案）：vsix 源码项目产 `.vsix` → registry 项目扫描/生成 metadata/HTTP 分发 → opensumi-web 运行时 fetch 清单集成。

---

## 2. metadata 结构（源码实测 `IExtensionBasicMetadata`）

CLI `getExtension(dir, mode)` 扫描扩展目录产出，运行时消费的完整结构：

```jsonc
{
  "extension": { "publisher": "agentnest", "name": "session-manager", "version": "0.1.0" },
  "packageJSON": {                 // 从 package.json pick 的字段
    "name", "publisher", "version", "repository", "displayName",
    "description", "icon", "activationEvents",
    "sumiContributes", "contributes", "browser"
  },
  "defaultPkgNlsJSON": {},          // package.nls.json（i18n 默认）
  "pkgNlsJSON": {},                 // 当前语言 nls
  "nlsList": [],                    // 语言包清单
  "extendConfig": {},               // kaitian.js 扩展配置
  "webAssets": [],                  // 额外 web 资源清单（kaitian-meta.json 的 web-assets）
  "mode": "public",                 // public | local
  "uri": "kt-ext://host/<id>"       // 资源根地址（关键）
}
```

**pick 字段与 kaitian 兜底**（实测 scanner.js）：`sumiContributes` 缺失时用 `kaitianContributes` 补；`contributes` 与 `sumiContributes` 会做 merge。

---

## 3. 资源加载机制（`kt-ext` 协议，源码实测）

### 3.1 uri → HTTP 解析
- `Extension.extensionLocation = staticResourceService.resolveStaticResource(URI.from(metadata.uri)).codeUri`（134313）。
- `kt-ext` scheme 解析器（`KtExtFsProviderContribution`，603542）：`resolveStaticResource: uri => uri.withScheme('https')`。
- 实际读文件（`OpenSumiExtFsProvider.readFile`，603486）：`uri.with({ scheme: location.protocol.slice(0,-1) })` 后 `fetch`——**按当前页面协议**（http 本地 / https 线上），非强制 https。

**结论**：`uri = kt-ext://<host>/<extId>`，运行时 fetch `<pageProtocol>://<host>/<extId>/out/views.js` 等。`<host>` 指向任意可访问的静态服务/CDN/OSS。

### 3.2 内置 roots（仅供参考）
kt-ext 默认 roots 为阿里云 CDN（`alipayobjects.com`），自建分发不受限——只要 host 可跨域访问即可。

---

## 4. 集成方式：构建期 vs 运行时（实测对比）

| 方式 | 做法 | 适用 | AgentNest 取舍 |
|------|------|------|----------------|
| 构建期内联 | 把 metadata（含 browser/worker 相对路径）打进 webpack bundle（官方 sample 的 `WorkerExample`） | demo/内置扩展 | 否，容器会耦合业务 |
| 构建期 import | 脚本生成 `extensions.generated.ts`，容器 import | 快速验证 | POC 早期用过，已废弃 |
| **运行时 fetch** | `<AppRenderer>` 挂载前 `fetch` 清单接口，`setState` 后传入 `extensionMetadata` | **生产** | ✅ 采用 |

运行时方案（`poc/opensumi-web/src/App.tsx` 实测）：
```tsx
const meta = await registryClient.fetchMetadata();  // GET registry /metadata.json
<AppRenderer appConfig={{ ...appConfig, extensionMetadata: meta }} ... />
```
容器纯净、零业务；新增/下线扩展只改 registry，容器不重新构建。

---

## 5. AgentNest 三层分发架构

```
各 vsix 源码项目（独立维护，单一职责）
  └─ build + vsce/sumi package → xxx.vsix
                    │  投放
                    ▼
extension-registry（独立项目，扫描 + 生成 + 分发）
  vsix/                        固定目录，放 .vsix
  src/build.ts                 扫描 vsix → 解压 dist/<id>/ → 生成 dist/metadata.json
  src/server.ts                HTTP 静态分发 dist/（CORS 放行）
                    │  GET /metadata.json + /<id>/out/*.js
                    ▼
opensumi-web（纯容器，运行时集成）
  App.tsx 启动 fetch metadata → <AppRenderer extensionMetadata>
  运行时按各 metadata.uri（kt-ext://registry-host/<id>）拉资源激活
```

- **单一职责**：vsix 源码只管产包；registry 只管收纳/生成/分发；容器只管消费。
- **metadata 生成在 registry 构建期**（Node，`--experimental-strip-types` 跑 TS/ESM），不污染前端运行时。
- **uri 指向 registry**：`kt-ext://<registry-host>/<extId>`，多扩展可挂不同 host/CDN。

> 生成实现取舍：CLI `getExtension()` 依赖其**内部路径** `@codeblitzjs/ide-cli/lib/extension/scanner.js`（非公开导出），且 `local` 模式的 `localUri` 拼接对 opensumi URI 类型有 bug。registry 采用**自实现生成**（结构已从源码完全摸清），去 CLI 内部依赖，更稳。

---

## 6. 市场生态（分发的另一维度）

- VSCode 官方 Marketplace 有**许可限制**（仅授权微软产品使用），第三方 IDE 不可直连。
- 开源 IDE 通用方案是 **Open VSX**（Eclipse 基金会）。OpenSumi/CodeBlitz 可对接自建或 Open VSX 作扩展源。
- `@opensumi/cli` 提供 `publish`/`login`，指向 OpenSumi 自有扩展市场（待验证具体 registry 地址与私有化部署方式）。
- AgentNest POC 阶段：**自建 registry 静态分发**足够，市场化是后续选项。

---

## 7. 端到端验证结论（实测跑通）

全链路已在浏览器实测通过：**registry 生成 metadata → opensumi-web 运行时 fetch 清单 → kt-ext 加载扩展资源 → worker 激活 + browser 视图注册左侧面板 → 面板直连 opencode `POST /session` 新建会话 → 列表刷新**（后端会话数 0→1，面板显示一致）。

三个**必须正确否则失败**的关键点（实测踩坑）：

1. **`mode: 'local'` + `uri`**：源码 609947 `ext.mode === 'local' && ext.uri ? ext.uri : getExtensionPath(...)`。设 `'public'` 会走市场 CDN 路径，资源请求被打到 `gw.alipayobjects.com` 而 404。
2. **`contributes` 必须合并 `sumiContributes`**：源码 133157 激活视图判定是 `contributes.browserMain`（非 `sumiContributes.browserMain`）。registry 生成时须 `mergeContributes`（同名数组拼接），否则 browserMain/browserViews 不加载、面板不出现。
3. **kt-ext 强制 https**：`KtExtFsProviderContribution` 硬编码 `withScheme('https')`，扩展资源必走 https。本地 registry 需自签证书 + 钥匙串信任；生产 CDN/OSS 本就是 https。

其他实测点：
- 宿主注入的 React 全局是**大写 `React`**，扩展须 `require('React')`（esbuild external `React`），否则 `useState` undefined。
- 活动栏图标名须在内置图标库内，缺失（如 `comment-discussion`）不影响面板注册，仅图标区空白。

## 8. 待验证

- [ ] 换内置存在的活动栏图标（当前缺失图标，面板可点开但图标空白）。
- [ ] `kt-ext` 从自建 host 拉资源（已实测 localhost https 可行；生产 CDN roots 白名单待验证）。
- [ ] 多 vsix、版本升级时清单/缓存策略（IndexedDB 缓存 vs 强制刷新）。
- [ ] 私有市场（Open VSX 自建 / OpenSumi marketplace）部署与鉴权。
- [ ] 生产 CDN/OSS 托管下 CORS、gzip、缓存头，去掉本地自签证书环节。
- [ ] browser 面板改经 worker 代理调 opencode（当前直连），配合鉴权/会话状态集中。

---

*本文档随调研推进持续更新。*
