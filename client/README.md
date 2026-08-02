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

## 功能设计

client 是用户在浏览器侧的 IDE 容器，登录后获取独享沙箱，可与 OpenCode 智能体协作。本节按用户视角描述 client **终态**的完整可视化功能。

### 1. 入口与拓展加载

- 用户访问 client 入口时，自动访问 registry 加载业务 VSIX
- 加载完成后，VSIX 拓展激活；用户的登录状态（`username` / `userId` / `avatarUrl`）自动传递给拓展
- 加载失败时，client 仍可访问，拓展缺失不影响 IDE 核心能力

### 2. 登录

- **未登录时**：弹出登录页（默认 GitHub OAuth），登录后回到主流程
- **默认实现**：GitHub OAuth 登录（`server.ts` 承载 OAuth 流程）
- **可被 VSIX 替换**：自定义登录页面 VSIX 可替换默认实现，但必须通过 client 暴露的 commands 读写登录状态——login 与登录页面 VSIX 职责分离
- **登录状态数据模型**：
  - `username`：用户名
  - `userId`：用户唯一标识
  - `avatarUrl`：用户头像 URL
- 登录完成后，client 携带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头向 gateway 申请沙箱

### 3. 沙箱与文件系统

- 登录后，client 自动访问 gateway 获取沙箱
- 沙箱就绪后，自动激活 OpenSumi 文件系统对接沙箱
- 内置 explorer 可直接访问沙箱内的文件 / 目录
- 业务 VSIX 通过 `taichu.fs.*` commands 读写文件：读 / 列走 HTTP，写 / 创建 / 删走 PTY + shell（agent-image 不暴露 `POST /file` 类 API）

### 4. AI 侧栏

- **顶部 TopBar**：右侧按钮切换 AI 侧栏（未展开 / 展开 两态图标）
- 接入沙箱后，自动初始化 OpenCode SDK 客户端（`@opencode-ai/sdk`）
- 面板内提供：
  - **新会话**：点击新增会话并清空消息列表；空会话不重复创建；运行中二次确认
  - **历史会话**：弹窗列出历史会话，点击进入对应会话
  - **消息发送**：文字 / 图片 / 文件输入 / 粘贴；图片与文件粘贴走 fs 拓展的"上传"通道
  - **消息列表**：用户消息在右侧，AI 回复在左侧；SSE 流式渲染
  - **附件上传**：图片 / 文件粘贴通过 fs 通道写入沙箱
  - **切换模型**：支持切换 OpenCode 模型
  - **A2UI 交互控制**：Agent 生成 `xxx.paper` 等业务资产时，自动触发相关拓展接管渲染
- SDK 实例封装为 commands 暴露给其他 VSIX：`taichu.ai.session.*` / `taichu.ai.message.*` / `taichu.ai.attachment.upload` / `taichu.ai.model.switch` / `taichu.ai.a2ui.interact`
- OpenCode SSE 监听 + emitter 转发：业务 VSIX 通过 `window.addEventListener('taichu:opencode-event', ...)` 监听事件

### 5. layout 控制

- 切换显示 / 隐藏 AI 侧栏：`taichu.layout.right.toggle/show/hide`
- 切换显示 / 隐藏 左侧面板：`taichu.layout.left.toggle/show/hide`
- 切换显示 / 隐藏 标题栏：`taichu.layout.top.toggle/show/hide`
- 业务 VSIX 可调用这些 commands 触发 layout 变更

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

- **拓展加载 + 状态传递**：用户访问 client 入口时，client 自动访问 registry 动态加载业务 VSIX 拓展，并将用户登录状态（username / userId / avatarUrl）传递给拓展，完成激活
- **默认实现**：GitHub OAuth 登录（由 `server.ts` 提供 `/auth/github/login` + `/auth/github/callback` + `/auth/github/logout`）
- **可被 VSIX 替换**：自定义登录页面 VSIX 可替换默认实现，但必须通过 client 暴露的 commands 读取和写入登录状态——login 拓展与登录页面 VSIX 职责分离
- **登录状态数据模型**：
  - `username`：用户名
  - `userId`：用户唯一标识
  - `avatarUrl`：用户头像 URL
- OAuth 回调后登录状态写入 `/etc/taichu/.env`（K8s hostPath 持久化），同时通过 `window` 全局注入到前端
- 登录完成后，client 携带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头向 gateway 发起 `POST /runtime`
- gateway 命中已有沙箱 → 直接返回 `runtimeId` + `baseUrl`；未命中 → 创建 Pod → 等待 SSE: `READY` → 返回 `baseUrl`
- `baseUrl = http://{runtimeId}.{RUNTIME_HOST_SUFFIX}`，是后续 fs / ai-panel 的前置条件

### 2. fs — 沙箱文件系统通道

- login 拿到 `baseUrl` 后，fs 拓展**自动**访问 gateway 获取沙箱环境；环境可用时，自动激活 OpenSumi 文件系统对接沙箱
- **OpenSumi 文件系统对接**：让 `@opensumi/ide-explorer` 等内置模块能直接访问沙箱内的文件 / 目录（无需 VSIX 自己 fetch）
- 读操作走 HTTP：
  - `GET /file?path=...` 列目录
  - `GET /file/content?path=...` 读文件
- 写操作走 PTY + shell 脚本（agent-image 不暴露 `POST /file` 类 API）：
  - `mkdir -p` / `touch` 创建目录或文件
  - `printf %s <base64> | base64 -d > <path>` 写文件
  - `rm -rf` 删除路径
- 所有写操作经由 `POST /pty` 派发，会话期间持续在线；沙箱重建时 fs 通道自动重连
- **统一 fs API + commands 暴露给其它 client 拓展 / 业务 VSIX 使用**：跨拓展 IO 一律经 fs 客户端，不得直接 fetch `${baseUrl}/file...`；commands 命名为 `taichu.fs.{action}`（读 / 写 / 建 / 删 / 上传）
- **上传接口**（图片 / 文件粘贴）：fs 拓展提供"上传到沙箱工作区"的能力，ai-panel 拓展通过 `taichu.fs.upload` command 调用此接口实现粘贴上传

### 3. ai-panel — AI 侧栏

- 顶部 TopBar 右侧按钮切换右侧栏（未展开图标 / 展开图标）；通过 layout 控制命令 `taichu.layout.right.toggle`
- **自动接入沙箱内 OpenCode**：拿到 `baseUrl` 后，自动用 `@opencode-ai/sdk` 实例化客户端，SDK 生命周期由 ai-panel 持有
- **SDK 实例封装为 commands 暴露给其他 VSIX**：业务 VSIX 通过 commands 调用，不直接 `import { createOpencodeClient } from '@opencode-ai/sdk'`：
  - `taichu.ai.session.create` — 创建会话
  - `taichu.ai.session.list` — 历史会话
  - `taichu.ai.session.switch` — 切换会话
  - `taichu.ai.message.send` — 发送消息
  - `taichu.ai.message.stream` — 流式消息
  - `taichu.ai.attachment.upload` — 附件上传（走 fs 通道写入沙箱）
  - `taichu.ai.model.switch` — 切换模型
  - `taichu.ai.a2ui.interact` — A2UI 交互控制
- **OpenCode SSE 监听 + emitter 转发**：client 内监听 `${baseUrl}/global/events`，通过 `window` event emitter 推送（事件类型：`message.updated` / `message.part.updated` / `session.status` / `session.idle` / `session.error` / A2UI 等）；其他 VSIX 通过 `window.addEventListener('taichu:opencode-event', ...)` 监听
- **A2UI 交互控制**：当 Agent 生成 `xxx.paper` 等业务资产时，ai-panel 通过 A2UI 事件通知相关拓展接管渲染（示例：`yunyan-paper-web` 收到 A2UI 触发后加载并显示 `xxx.paper` 文件）
- **ai-panel 内部 UI**：
  - **新会话**（按钮）：点击新增会话并清空消息列表。若当前会话为空则不重复创建；若当前会话运行中则二次确认
  - **历史会话**（按钮）：点击弹窗列出历史会话，点击进入对应会话；交互与新会话一致
  - **消息发送**（输入框）：支持文字 / 图片 / 文件输入 / 粘贴；图片与文件粘贴走 fs 拓展的"上传"通道（`taichu.fs.upload`）写入沙箱工作区，再以附件 parts 发送给 AI
  - **消息列表**（对话消息框）：用户消息在右侧，AI 回复在左侧；支持 SSE 流式渲染

### 4. layout 控制

- **切换显示 / 隐藏 AI 侧栏**：`taichu.layout.right.toggle/show/hide`，默认由 TopBar 按钮触发
- **切换显示 / 隐藏 左侧面板**：`taichu.layout.left.toggle/show/hide`
- **切换显示 / 隐藏 标题栏**：`taichu.layout.top.toggle/show/hide`
- 业务 VSIX 可调用这些 commands 触发 layout 变更（如：Agent 自动展开 ai-panel 显示实时结果；按需收起左侧面板给编辑器更多空间）

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

client 的所有可调参数都不散落代码里，按作用域分**五层**：

| 层 | 来源 | 内容 |
|----|------|------|
| 构建期 | `package.json` / `webpack.config.js` / `tsconfig.json` | 入口、loader、别名、devServer |
| 静态 | `src/config/*.ts` | `layoutConfig` / `defaultPreferences` / `runtimeConfig` |
| 环境配置 | `.env.{DEPLOY_ENV}`（template 见 `.env.example`） | HOST 按环境划分（详见下） |
| 运行期 | K8s `ConfigMap: client-config` 注入 ENV | `DEPLOY_ENV` / `GATEWAY_URL` / `REGISTRY_URL` / `RUNTIME_HOST_SUFFIX` |
| 用户持久化 | `/etc/taichu/.env`（hostPath） | `X_USER_ID`（OAuth 后写入，Pod 重建后仍可复用） |

### HOST 按环境划分

dev / staging / prod 三个环境的服务 HOST（仅作示例，实际以 `.env.{DEPLOY_ENV}` 为准）：

| 服务 | dev（`*.taichu.localhost`） | staging（`*.staging.taichu.com`） | prod（`*.taichu.com`） |
|------|---------------------------|----------------------------------|----------------------|
| `GATEWAY_URL` | `http://gateway.taichu.localhost` | `https://gateway.staging.taichu.com` | `https://gateway.taichu.com` |
| `REGISTRY_URL` | `http://registry.taichu.localhost` | `https://registry.staging.taichu.com` | `https://registry.taichu.com` |
| `RUNTIME_HOST_SUFFIX` | `runtime.taichu.localhost` | `runtime.staging.taichu.com` | `runtime.taichu.com` |

### `.env` 文件维护

- **`.env.example`**：模板，提交到 git，描述所有可配置项
- **`.env.development`** / **`.env.staging`** / **`.env.production`**：按环境维护，gitignore
- webpack 通过 `dotenv-webpack` 读 `.env.${DEPLOY_ENV}`；server.ts 通过 `dotenv` 读 `.env.${DEPLOY_ENV}`
- `DEPLOY_ENV` 决定加载哪个 `.env.*` 文件（webpack 与 server.ts 需一致）

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

## 已知问题

- Monaco worker 走阿里云 CDN（离线 / 受限网络失败）。
- 文件 / 目录判定用「扩展名」启发式（生产应改 `stat` 精确判断）。
- IndexedDB 与 opencode 落盘对账策略未完善。
- 重命名（删除 + 新建）行为待验证。
- 写操作走 PTY + shell 脚本，大文件落盘性能待实测。