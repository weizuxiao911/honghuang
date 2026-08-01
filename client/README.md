# 交互平面

> 本目录对应 `taichu/client/`，即太初**交互平面**（浏览器侧 IDE 容器宿主）。基于 OpenSumi / CodeBlitz 的零业务前端骨架，业务能力全部由 VSIX 承载。

## 定位

- **做**：浏览器 IDE 容器（OpenSumi / CodeBlitz 内核）、布局骨架（slot）、窗口生命周期、VSIX 宿主、全局 command 总线、登录与会话建立、与后端基础设施直连的三个核心内置服务（见下）。
- **不做**：业务 UI、业务命令、业务状态机、Agent 推理、K8s 调度、VSIX 资产存储。

详细的产品定位、价值主张、用户旅程见 [`../功能设计.md §2 交互平面`](../功能设计.md#2-交互平面)；技术分层、模块边界、接口契约、部署形态见 [`../架构设计.md §2.1 交互平面app`](../架构设计.md#21-交互平面app)。本文件的 AI 协作约束见 [`AGENTS.md`](./AGENTS.md)。

## 浏览器 IDE 体验

用户打开 client 入口即可得到完整 IDE 容器，无需安装任何扩展：

| 区域 | 用途 |
|------|------|
| 顶部标题栏 | 品牌、工作区切换、搜索、版本 / 账户 |
| 左侧活动栏 + 侧栏 | 资源管理器、搜索、源代码管理、调试器 |
| 中央编辑区 | 文件 Tab / Welcome / 编辑器主区 |
| 右侧栏 | Agent 对话窗口（由 `taichu-chat-window` VSIX 注入） |
| 底部面板 | 输出 / 问题 / 调试控制台 |
| 状态栏 | Launchpad / 错误计数 / Git 状态 |

编辑器内核复用 VS Code 生态的成熟组件（Monaco、文件树、Diff、Search、SCM），用户不必切换工具栈。

## 布局与分区：VSIX 与 slot 的关系

client 容器由 OpenSumi / CodeBlitz 的布局系统划成 8 个常用分区（技术上框架支持 14 个槽位），每个分区是一个独立渲染区域。VSIX 不是直接"挂到槽位"，而是通过 VS Code 标准字段暴露视图容器，再经 OpenSumi 扩展点把视图挂到目标 slot：

- **VS Code 标准字段**（`package.json`）：`contributes.views` / `contributes.viewsContainers` / `contributes.commands` —— 定义视图 id、容器 id、标题、icon、when 等。
- **OpenSumi 扩展字段**（`package.json`）：`sumiContributes.browserViews.{slot}`（`type: "add"`）—— 把已声明的视图挂到目标 slot。
- **运行时槽位**（框架私有命名）：`top` / `left` / `main` / `right` / `bottom` / `statusBar` / `action` / `extra` 等。
- **运行时入口**：VSIX `activate()` 阶段向 `LayoutService` / `CommandService` 注册贡献。

> **VSIX 必须按 VS Code 兼容扩展标准开发**：`package.json` 必须声明 `engines.vscode`，业务能力走 `contributes.*` 字段；OpenSumi 扩展点（`sumiContributes.*`、slot 命名）只在需要 OpenSumi 专属能力时作为补充，不替代 VS Code 标准字段。

## 核心内置服务（与后端基础设施直连，VSIX 不直接接入）

client 除了渲染 IDE 骨架与装载 VSIX 之外，承担三个**VSIX 不能做、也不必做**的核心内置服务，封装在 `src/services/` 与 `src/config/` 下，对 VSIX 暴露稳定接口。

### 1. 登录与会话建立

- 用户访问 client 入口后触发登录（当前接入 GitHub OAuth）。
- 登录成功后 client 立即向 gateway 发起 `POST /runtime`，由 gateway 校验身份并返回 `baseUrl`。
  - gateway 命中已有沙箱 → 直接返回 `runtimeId` + `baseUrl`；
  - 未命中 → 创建 Pod → 等待 SSE: `READY` → 返回 `baseUrl`。
- **baseUrl 不是配置项**，而是 `POST /runtime` 响应的运行时产物（`{runtimeId}.{RUNTIME_HOST_SUFFIX}`）。
- 该步是后续所有功能的前置条件：没有登录就拿不到 `baseUrl`，就没有 fs 通道，也没有 OpenCode SDK。

### 2. fs 文件系统通道

- 拿到 `baseUrl` 后，client **自动**与沙箱内文件系统建立连接（HTTP `GET/POST /file`、`GET /file/content`、`POST /pty`），并把文件操作封装成**统一的 fs API 暴露给 VSIX**（列目录、读、写、建、删）。
- **VSIX 不直接 `fetch ${baseUrl}/file...`**：所有文件 IO 一律经 client 的 fs 客户端，VSIX 只调用 client 提供的命令或 API。
- 整段 IDE 使用期间 fs 通道持续在线；会话失效或沙箱重建时 fs 通道自动重连。
- 实现位于 `src/services/opencode.ts`（`OpencodeFileClient`）。

### 3. OpenCode SDK 与事件流

- client 登录后用 `baseUrl` 实例化 OpenCode SDK 客户端，并把实例挂到稳定的全局（如 `window.__TAICHU_OPENCODE__`）供 VSIX 消费。
- **VSIX 不直接 `import { createOpencodeClient } from '@opencode-ai/sdk'`**：SDK 的生命周期、连接复用、错误重连由 client 负责。
- client 同时实现 OpenCode `global/events` SSE 订阅，把事件通过 `window` 上的 event emitter 转发出去。
- VSIX 用 `window.addEventListener('opencode:event', ...)` 消费事件（`message.updated` / `message.part.updated` / `session.status` / `session.idle` / `session.error` 等），不需要自己接 SSE。

## 业务能力如何注入

业务**不写进 IDE 内核**，而是由 VSIX 注入到目标 slot / 视图容器：

| 槽位 | VSIX | 源码位置 |
|------|------|----------|
| 左侧栏（会话管理） | `taichu-session-manager` | [`../extensions/session-manager/`](../extensions/session-manager/) |
| 右侧栏（对话窗口） | `taichu-chat-window` | [`../extensions/chat-window/`](../extensions/chat-window/) |
| 中央编辑区空态（着陆页） | `taichu-landing-page` | [`../extensions/landing-page/`](../extensions/landing-page/) |
| 插件市场（常驻入口） | `taichu-yunyan-paper-web`（暂用） | [`../extensions/yunyan-paper-web/`](../extensions/yunyan-paper-web/) |

用户在「插件市场」装卸 / 升级 VSIX 后，IDE 的对应槽位即时呈现新的视图 —— 这是"业务与基座解耦"的产品侧体现。VSIX 源码统一在 `taichu/extensions/{name}/`，**不在**本目录下；运行时由 client 启动期从 `registry` 拉取并装载。

> **VSIX 生命周期**：源码在 `taichu/extensions/{name}/` → `vsce pack` 打成 `.vsix` → 上架 `registry`（入库 + CDN/OSS）→ client 启动期 `GET /metadata.json` 拉清单并下载 → `ExtensionService` 装载 → `activate()` 阶段向 LayoutService / CommandService 注册贡献。

## 目录结构

```
client/
├── README.md                 # 本文件（人看）
├── AGENTS.md                 # AI 协作约束
├── package.json              # taichu-client（CodeBlitz 容器构建）
├── tsconfig.json
├── webpack.config.js
├── server.ts                 # 本地静态服务入口（express）
├── Dockerfile                # 镜像构建
├── k8s/                      # K8s 清单（Namespace / ConfigMap / Deployment / Service / Ingress）
│   └── deploy.yaml
└── src/                      # CodeBlitz 容器入口与配置（**零业务**）
    ├── index.tsx             # ReactDOM 入口
    ├── App.tsx               # AppRenderer 装配
    ├── index.html            # HTML 模板
    ├── components/           # 框架级组件（如 TopBar、WelcomePage）
    ├── config/               # 配置外置（appConfig / runtimeConfig / layout / bootstrap）
    ├── services/             # 三个核心内置服务的实现
    │   ├── opencode.ts       # fs 文件客户端（VSIX 消费）
    │   └── registry.ts       # registry 客户端（拉 VSIX 元数据）
    └── styles/               # 全局样式覆盖
```

> **目录约束**：`src/` 严禁出现业务 UI / 业务命令 / 业务状态机；任何"在 client 里加一段业务代码"的请求，默认拒绝并转去 `taichu/extensions/{name}/`。

## 配置外置

client 的所有可调参数都不散落代码里，按作用域分三层：

| 层 | 来源 | 内容 |
|----|------|------|
| 构建期 | `package.json` / `webpack.config.js` / `tsconfig.json` | 入口、loader、别名、devServer |
| 静态 | `src/config/appConfig.json` `src/config/runtimeConfig.json` `src/config/layout.tsx` | `appConfig`（注册入口、启动参数）、`builtInExtensions`、`runtimeConfig.extensionMetadata`、slot 布局 |
| 运行期 | K8s `ConfigMap: client-config` 注入 ENV | `GATEWAY_URL` / `RUNTIME_HOST_SUFFIX` / `DEPLOY_ENV` |

`baseUrl` 不在配置里，由 `POST /runtime` 响应下发。

## 启动方式

### 本地开发

前置：gateway + registry 已起；可选地 agent-image 已起（用于 fs 通道实跑）。

```bash
cd client
npm install
npm run dev                  # http://localhost:8888
```

dev 期可通过 ENV 覆盖下游地址（仅供本地调试）：

```bash
GATEWAY_URL=http://127.0.0.1:8080 \
RUNTIME_HOST_SUFFIX=runtime.taichu.localhost \
DEPLOY_ENV=dev \
EXTENSION_REGISTRY_URL=http://127.0.0.1:9000 \
  npm run dev
```

> 生产环境严格走 K8s `ConfigMap` 注入，不要在镜像里硬编码任何下游地址或凭据。

### K8s 部署

```bash
kubectl apply -f k8s/deploy.yaml        # Namespace + ConfigMap + Deployment + Service + Ingress
```

部署后通过 `http://client.taichu.localhost`（docker-desktop 上 `*.localhost` 自动解析 127.0.0.1）访问。Ingress 注解已带 SSE 长连接支持（`proxy-read-timeout: 3600` / `proxy-send-timeout: 3600`）与大报文支持（`proxy-body-size: 100m`）。

## 与其它模块的接口

client 是所有跨层调用的中枢，但**只走约定接口**，禁止任何形式的跨包直接 import。

| 对端 | 接口 | 关键约定 |
|------|------|----------|
| registry | `GET /metadata.json`、`GET /vsix/{name}-{version}.vsix` | 启动期一次拉清单 + 按需下包（由 `src/services/registry.ts` 封装） |
| gateway（控制平面） | `POST /runtime` | 登录后调用，携带 `X-User-Id` / `X-Tenant-Id`；返回 `baseUrl` |
| gateway（数据平面） | 主域名 + 子域名 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` | `Host` 路由；fs 通道与 OpenCode SDK 数据流都走子域名 |
| agent-image（fs 通道） | `GET/POST /file`、`GET /file/content`、`POST /pty` | baseUrl = `{runtimeId}.{RUNTIME_HOST_SUFFIX}`；贯穿 IDE 全程 |
| agent-image（OpenCode） | `global/events` SSE、`window.__TAICHU_OPENCODE__` SDK 实例 | client 封装后通过 `window` event emitter 暴露给 VSIX |
| VSIX（业务插件） | 全局 command ID（`{publisher}.{name}:{action}`）+ `window.__TAICHU_OPENCODE__` + `window.addEventListener('opencode:event', ...)` + fs API | 唯一合法通道；禁止任何形式的跨包 import |

## 边界约束

- 纯浏览器运行（`server.ts` 仅用于本地静态托管与健康检查）；**生产无 Node.js 运行时、无后端业务逻辑**。
- **不直连 K8s**、不解析 A2UI 业务语义、不存储 VSIX 包、不内置业务 UI / 命令 / 状态机。
- 业务 VSIX 源码**不在** `taichu/client/` 内，统一维护在 `taichu/extensions/{name}/`。
- 插件与插件、插件与容器之间**仅**通过全局 command ID 联动。
- 与 agent-image 的所有数据通道**必须**经 gateway（控制平面走 `POST /runtime`，数据平面走 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` 子域名反代），不允许在生产环境直连 agent-image Pod IP。
- 鉴权 Header（`X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` / `X-Runtime-Id`）由 gateway 注入并透传，client 不硬编码凭据。

## UI 设计（待迭代）

当前 UI 设计：左侧 `session-manager`（搜索 + 新对话 + 时间分组列表 + 可折叠），右侧 `chat-window`（消息气泡 + 流式光标 + SSE 实时更新），中央 `landing-page`（marquee 大字标题），顶部为项目级 IDE 标题栏。UI 风格、交互细节、信息密度**待后续迭代**。

## 已知问题

- Monaco worker 走阿里云 CDN（离线 / 受限网络失败）。
- 文件 / 目录判定用「扩展名」启发式（生产应改 `stat` 精确判断）。
- IndexedDB 与 opencode 落盘对账策略未完善。
- 重命名（删除 + 新建）行为待验证。
- 本期不实现 VSIX 运行时热替换，registry 元数据变更需重启 client 生效。
