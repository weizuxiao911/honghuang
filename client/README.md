# 交互平面（client）

> 本目录对应 `taichu/client/`，即太初**交互平面**（浏览器侧 IDE 容器宿主）。基于 OpenSumi/CodeBlitz 的容器骨架，按 `@opensumi/ide-core-browser` 标准维护内置拓展；client **不**承载业务 VSIX。

## 这是什么

client 是太初的浏览器侧入口：

- **容器骨架**：OpenSumi/CodeBlitz 内核驱动，`AppRenderer` 装配 slot / preferences / runtime 三类配置
- **三个内置服务**：login（GitHub OAuth + 会话建立）、fs（沙箱文件系统通道）、ai-panel（AI 侧栏，对接 OpenCode 智能体）
- **一个拓展一个目录**：所有内置拓展按 `@opensumi/ide-core-browser` 标准开发，落在 `src/components/{name}/`，独立目录、独立 Module / Contribution

client **消费 registry 作为拓展市场**：启动期调用 `registryClient.fetchMetadata()` 拉取 VSIX 元数据清单，按清单从 CDN/OSS 下载 `.vsix` 包并装入 `ExtensionService`（即 `runtimeConfig.extensionMetadata`），由 OpenSumi 运行时激活。**示例功能**：`extensions/yunyan-paper-web/`（常驻入口，详见 [`../registry/README.md`](../registry/)）。

registry 模块的职责（VSIX 元数据存储、版本管控、灰度发布、RBAC 裁剪、CDN/OSS 包分发）详见 [`../registry/README.md`](../registry/)；接口契约详见 [`../架构设计.md §5 接口契约`](../架构设计.md#5-接口契约)。

详细的产品定位、价值主张、用户旅程见 [`../功能设计.md §2 交互平面`](../功能设计.md#2-交互平面)；技术分层、模块边界、接口契约、部署形态见 [`../架构设计.md §2.1 交互平面app`](../架构设计.md#21-交互平面app)。本文件的 AI 协作约束见 [`AGENTS.md`](./AGENTS.md)。

## 单一职责边界

| 做 | 不做 |
|----|------|
| CodeBlitz 容器骨架（`AppRenderer` 装配） | 业务 VSIX 扩展 |
| slot / preferences / runtime 三类装配配置 | Agent 推理 / 工具调用 |
| **login** 内置拓展（OAuth 入口 + 会话建立） | 调度决策 / K8s 编排 |
| **fs** 内置拓展（沙箱文件系统通道） | A2UI 业务语义解析 |
| **ai-panel** 内置拓展（OpenCode 智能体对接） | 跨模块直接 import |
| 与 gateway / agent-image / registry 的接口契约 | 凭据硬编码 |

## 三个内置服务

client 除了渲染 IDE 骨架之外，承担三个**与后端基础设施直连**的内置服务，封装为三个独立拓展，落在 `src/components/{login,fs,ai-panel}/`。

### 1. login — 登录与会话建立

- 用户访问 client 入口后若未登录（`X_USER_ID` 为空），跳转 GitHub OAuth（由 `server.ts` 提供 `/auth/github/login` + `/auth/github/callback` + `/auth/github/logout`）
- OAuth 回调后 `X_USER_ID`（= GitHub `user.id`）写入 `/etc/taichu/.env`（K8s hostPath 持久化）
- 登录完成后返回主页，客户端读取 `window.__TAICHU_DEPLOY_CONFIG__`（由 `server.ts` 注入），携带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头向 gateway 发起 `POST /runtime`
- gateway 命中已有沙箱 → 直接返回 `runtimeId` + `baseUrl`；未命中 → 创建 Pod → 等待 SSE: `READY` → 返回 `baseUrl`
- `baseUrl = http://{runtimeId}.{RUNTIME_HOST_SUFFIX}`，是后续 fs / ai-panel 的前置条件

### 2. fs — 沙箱文件系统通道

- login 拿到 `baseUrl` 后，fs 拓展**自动**与沙箱建立连接
- 读操作走 HTTP：
  - `GET /file?path=...` 列目录
  - `GET /file/content?path=...` 读文件
- 写操作走 PTY + shell 脚本（agent-image 不暴露 `POST /file` 类 API）：
  - `mkdir -p` / `touch` 创建目录或文件
  - `printf %s <base64> | base64 -d > <path>` 写文件
  - `rm -rf` 删除路径
- 所有写操作经由 `POST /pty` 派发，会话期间持续在线；沙箱重建时 fs 通道自动重连
- **统一 fs API 暴露给其它 client 拓展使用**，跨拓展 IO 一律经 fs 客户端，不直接 fetch `${baseUrl}/file...`

### 3. ai-panel — AI 侧栏

- 顶部 TopBar 右侧按钮切换右侧栏（未展开图标 / 展开图标）
- 面板内是 Agent 拓展，使用 `@opencode-ai/sdk` 对接沙箱内的 OpenCode 智能体
- 功能：
  - **新会话**（按钮）：点击新增会话并清空消息列表。若当前会话为空则不重复创建；若当前会话运行中则二次确认
  - **历史会话**（按钮）：点击弹窗列出历史会话，点击进入对应会话；交互与新会话一致
  - **消息发送**（输入框）：支持文字 / 图片 / 文件输入 / 粘贴；图片与文件粘贴走"上传"通道——通过 fs 拓展写入沙箱工作区，再以附件形式发送给 AI
  - **消息列表**（对话消息框）：用户消息在右侧，AI 回复在左侧；支持 SSE 流式渲染
- 订阅 OpenCode `global/events` SSE（`message.updated` / `message.part.updated` / `session.status` / `session.idle` / `session.error`），通过 `window` event emitter 转发
- 跨拓展（fs / ai-panel）通过 fs 客户端的"上传"接口协作

## 目录结构

```
client/
├── README.md                 # 本文件（人看）
├── AGENTS.md                 # AI 协作约束
├── package.json              # taichu-client（CodeBlitz 容器构建）
├── tsconfig.json
├── webpack.config.js
├── server.ts                 # 本地静态托管 + GitHub OAuth + 配置注入（生产环境 K8s 镜像入口）
├── Dockerfile                # 镜像构建
├── k8s/                      # K8s 清单（Namespace / ConfigMap / Deployment / Service / Ingress）
│   └── deploy.yaml
└── src/                      # CodeBlitz 容器入口与配置
    ├── index.tsx             # ReactDOM 入口
    ├── App.tsx               # AppRenderer 装配（注入三类配置 + 内置拓展 Module）
    ├── index.html            # HTML 模板
    ├── components/           # 内置拓展（一个拓展一个目录，@opensumi/ide-core-browser 标准）
    │   ├── topbar/           # 框架 chrome + AI 面板切换按钮
    │   │   ├── index.ts      # TopBarModule + TopBarContribution
    │   │   └── TopBar.tsx
    │   ├── login/            # 登录与会话建立
    │   ├── fs/               # 沙箱文件系统通道
    │   └── ai-panel/         # AI 侧栏（OpenCode 智能体对接）
    ├── config/               # 容器装配配置（三类，按类型维护）
    │   ├── slots.ts          # layoutConfig（8 个 slot 与 builtin module）
    │   ├── preferences.ts    # defaultPreferences（主题 / 自动保存 / startup）
    │   └── runtime.ts        # runtimeConfig（框架级 filesystem）
    └── styles/               # 全局样式覆盖
        ├── overrides.css
        └── slots.css
```

> **目录约束**：`src/components/{name}/` 一个拓展一个目录，独立维护 Module / Contribution / 视图组件；任何"在 client 里加一段业务代码"的请求，默认拒绝并下沉到对应内置拓展。

## 配置外置

client 的所有可调参数都不散落代码里，按作用域分四层：

| 层 | 来源 | 内容 |
|----|------|------|
| 构建期 | `package.json` / `webpack.config.js` / `tsconfig.json` | 入口、loader、别名、devServer |
| 静态 | `src/config/*.ts` | `layoutConfig` / `defaultPreferences` / `runtimeConfig` |
| 运行期 | K8s `ConfigMap: client-config` 注入 ENV | `GATEWAY_URL` / `RUNTIME_HOST_SUFFIX` / `DEPLOY_ENV` |
| 用户持久化 | `/etc/taichu/.env`（hostPath） | `X_USER_ID`（OAuth 后写入，Pod 重建后仍可复用） |

`baseUrl` 不在配置里，由 `POST /runtime` 响应下发。

## 启动方式

### 本地开发

前置：gateway 已起（用于 OAuth + runtime）；可选地 registry / agent-image 已起。

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
| gateway（控制平面） | `POST /runtime` | login 完成后调用；携带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env`；返回 `baseUrl` |
| gateway（数据平面） | 主域名 + 子域名 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` | `Host` 路由；fs / ai-panel 数据流都走子域名 |
| agent-image（fs 通道） | `GET /file` / `GET /file/content` / `POST /pty` | `baseUrl = {runtimeId}.{RUNTIME_HOST_SUFFIX}`；读 HTTP / 写 PTY + shell |
| agent-image（OpenCode） | `global/events` SSE、`@opencode-ai/sdk` 客户端 | 由 ai-panel 拓展封装，订阅 / 转发由 ai-panel 负责 |
| registry（拓展市场） | `GET /metadata.json` 拉清单 + `GET /vsix/{name}-{version}.vsix` 下载 VSIX 包 | 启动期一次 `registryClient.fetchMetadata()`；按清单从 CDN/OSS 下载后装入 `ExtensionService`（即 `runtimeConfig.extensionMetadata`）；示例功能 `yunyan-paper-web` 通过 registry 加载 |

## 边界约束

- 纯浏览器运行（`server.ts` 仅用于 OAuth + 静态托管 + 健康检查）；**生产无 Node.js 业务逻辑**。
- **不直连 K8s**、不解析 A2UI 业务语义、不存储 VSIX 包、不内置业务 VSIX 源码。
- **业务 VSIX 的资产加载走 registry**：启动期调用 `registryClient.fetchMetadata()` 拉清单 → 按清单从 CDN/OSS 下载 `.vsix` → 装入 `ExtensionService`。
- **不内置业务命令 / 业务状态机**；所有跨模块 / 跨拓展联动通过 OpenSumi 全局 command ID 或 `window` 事件总线。
- 与 agent-image 的所有数据通道**必须**经 gateway（控制平面走 `POST /runtime`，数据平面走 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` 子域名反代），不允许在生产环境直连 agent-image Pod IP。
- 鉴权 Header（`X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` / `X-Runtime-Id`）由 gateway 注入并透传，client 不硬编码凭据。

## UI 设计（待迭代）

当前 UI：顶部 TopBar（含 AI 面板切换按钮），左侧 explorer + search 侧栏，中央编辑器空态，右侧 ai-panel 侧栏，底部状态栏。UI 风格、交互细节、信息密度**待后续迭代**。

## 已知问题

- Monaco worker 走阿里云 CDN（离线 / 受限网络失败）。
- 文件 / 目录判定用「扩展名」启发式（生产应改 `stat` 精确判断）。
- IndexedDB 与 opencode 落盘对账策略未完善。
- 重命名（删除 + 新建）行为待验证。
- 写操作走 PTY + shell 脚本，大文件落盘性能待实测。