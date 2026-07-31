# langhuan（琅嬛）

> VSIX 插件资产分发中心。统一托管前端业务扩展包，为紫府提供插件拉取、版本管控、灰度、CDN。

详细职责、边界、与其它模块接口见 [`../设计文档.md`](../设计文档.md) 第二章「langhuan（琅嬛）」。

## 当前状态

**已迁移 .poc/extension-registry 完整代码**。本目录是 langhuan 模块的正式工程位，包含：

- vsix 扫描与 metadata 生成（`src/build.ts`）
- HTTPS 静态分发服务（`src/server.ts`）

> ⚠️ **与设计文档的差异**：设计文档第二章定位 langhuan 为 Spring Boot + MySQL + Redis + OSS + CDN 的生产级工程；当前实现为 Node.js + TypeScript 的 POC 验证版本，功能等价（扫描 → metadata → HTTPS 分发），但**生产化迁移到 Spring Boot 栈待后续推进**。

## 目录结构

```
langhuan/
├── README.md
├── AGENTS.md
├── package.json                # honghuang-langhuan
├── tsconfig.json
├── .gitignore
└── src/
    ├── build.ts                # 扫描 vsix/ → 解压 → 生成 dist/metadata.json
    └── server.ts               # HTTPS 静态分发（自签证书可选）
```

## 启动方式

```bash
cd langhuan
npm install

# 1. 生成自签证书（首次，本地开发；kt-ext 协议强制 https）
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -keyout certs/key.pem -out certs/cert.pem \
  -days 3650 -nodes -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
# 让浏览器信任（macOS，一次性）
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/cert.pem

# 2. 扫描 vsix 目录 + 生成 metadata
npm run build

# 3. 启动分发服务（https://localhost:9000）
npm run serve
```

投放新扩展：把 `.vsix` 丢进 `vsix/`，重跑 `npm run build`（server 实时读 `dist/`，无需重启）。

## 与其它模块的接口

- **下游消费者**：[`../zifu/`](../zifu/) 容器启动时按用户/租户拉取可用插件清单。
- **鉴权依赖**：用户/租户身份由 [`../taixu/`](../taixu/) 网关统一注入 Header，本模块按 RBAC 做可见性裁剪。
- **不**主动连接 [`../dongfu/`](../dongfu/)；与运行时 Agent 实例零耦合。

## 边界约束

- 仅负责**前端 VSIX 资源存储与分发**。
- 不解析 A2UI、不执行 Agent 任务、不参与 K8s 调度。
- 不维护登录态；鉴权透传自 taixu。

## 已知坑点（沿用 .poc 调研结论）

| 现象 | 根因 | 解法 |
|------|------|------|
| 扩展资源请求打到阿里云 CDN 404 | metadata `mode:'public'` | 改 `mode:'local'` 且带 `uri` |
| browserMain/views.js 不加载、面板不出现 | 运行时读 `contributes.browserMain`，未合并 sumiContributes | build 时 `mergeContributes` |
| `Cannot destructure 'useState' of React` | 宿主注入的全局是大写 `React`，扩展 `require('react')` 拿不到 | 扩展 `require('React')`，esbuild external `React` |
| `net::ERR_SSL_PROTOCOL_ERROR` | kt-ext 强制 https，本地自签 | 生成自签证书 + 钥匙串信任 |

## 后续演进

按 [`../设计文档.md`](../设计文档.md) 第二章规划，逐步迁移到生产级架构：

- 应用框架：Node.js/TS → Spring Boot
- 元数据存储：本地 JSON → MySQL
- 缓存/灰度：内存 → Redis
- 原始包存档：本地 vsix/ → 对象存储 OSS
- 静态分发：HTTPS Node server → CDN
- RBAC：基础裁剪 → 完整 RBAC 组件

迁移前需先与 [taixu](../taixu/) 网关打通鉴权 Header 透传链路。