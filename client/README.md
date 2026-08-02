# 交互平面（client）

> 本目录对应 `taichu/client/`，即太初**交互平面**（浏览器侧 IDE 容器宿主）。基于 OpenSumi/CodeBlitz 的容器骨架，按 `@opensumi/ide-core-browser` 标准维护内置 webview 与框架能力；client **不**承载业务 VSIX。

## 这是什么

client 是太初的浏览器侧入口：

- **容器骨架**：OpenSumi/CodeBlitz 内核驱动，`AppRenderer` 装配 slot / preferences / runtime 三类配置
- **内置 webview 槽位**：login（用户名/密码登录）/ userPage（账号弹窗），走 OpenSumi 标准 `SlotRenderer`，可被 VSIX 通过 VS Code 标准 `contributes.views + viewsContainers` 替换
- **内置框架能力**：fs（沙箱文件系统通道 + SandboxLoading 启动 loading）/ 槽位定义 / layout 控制
- **layout 控制**：左/右/底 panel 折叠/展开/拖拽 resize 走 OpenSumi 原生 `IMainLayoutService.toggleSlot`，TopBar 直连 DI

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

- **login 是一个槽位（slot）**：client 走 OpenSumi 标准 `<SlotRenderer slot="login">` 渲染；LayoutComponent 在 IDE 骨架外加 `<SlotRenderer slot="login">`，LoginView 自管 `position: fixed; inset: 0; z-index: 9999` 全屏 overlay 与显隐控制
- **未登录时**：用户访问 client 入口，操作触发 login overlay（点击 TopBar 登录按钮或 ai 拓展入口等），登录后回到主流程（`?redirect_to_url=` 透传回跳地址，默认首页）
- **默认实现**：用户名/密码登录（mock 演示）；OAuth 流程由 `server.ts` 承载
- **VS Code 扩展兼容标准（铁律 12）**：自定义 login VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='login'`，由 client 框架按 VS Code 标准暴露）替换默认 LoginView，可加载 vsix 自带的 webview 渲染真实登录 UI
- **登录状态数据模型**：
  - `username`：用户名
  - `userId`：用户唯一标识
  - `avatarUrl`：用户头像 URL
- 登录完成后，client 携带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头向 gateway 申请沙箱

### 3. 沙箱与文件系统

- 登录后，client 自动访问 gateway 获取沙箱
- **沙箱启动 loading**：login overlay 关闭后到沙箱就绪前显示 `SandboxLoading` overlay（spinner + "加载 sandbox 中,预计需等待 3~10s"）；错误态显示红色卡片 + 重试/退出登录
- 沙箱就绪后，自动激活 OpenSumi 文件系统对接沙箱（`sandbox:` scheme）
- 内置 explorer 可直接访问沙箱内的文件 / 目录（`workspaceDir: 'sandbox:/workspace'`，沙箱内真实 cwd）
- 业务 VSIX 通过 `taichu.fs.*` commands 读写文件：读 / 列走 HTTP，写 / 创建 / 删走 PTY + shell（agent-image 不暴露 `POST /file` 类 API）

### 4. 账号弹窗（userPage）

- TopBar 右侧的**账号按钮**（已登录时显示，圆形头像）点击 → 弹出 `userPage` 浮动弹窗（TopBar 下方右对齐，width 320px，z-index 9998）
- 默认 webview 内容：
  - 头部：头像 + 用户名 + Free 标识
  - "升级会员"按钮（占位）
  - 菜单列表：管理账号 / 消息（带徽标）/ 主题 / 检查更新 / 帮助文档 / 联系我们 / 报告问题
  - "退出登录"按钮（客户端轻量清除，不跳 server logout 端点）
- 关闭机制：点击弹窗外 / 按 Esc / `taichu:user-hide` 事件
- **VS Code 扩展兼容标准**：自定义 userPage VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='userPage'`）替换默认 UserView，加载 vsix 自带的 webview 渲染真实用户信息 UI

### 5. 右侧 AI 栏

- **顶部 TopBar**：右侧按钮切换右侧栏（未展开图标 / 展开图标）；通过 `IMainLayoutService.toggleSlot(right)`
- 右侧栏默认 view（`rightbar-default`）：欢迎卡片，提示业务 VSIX 可通过 `contributes.views + viewsContainers` 注册 view 注入
- 实际 AI 接入由业务 VSIX 完成（不在 client 内置）：
  - 自动接入沙箱内 OpenCode：拿到 `baseUrl` 后，自动用 `@opencode-ai/sdk` 实例化客户端
  - SDK 实例封装为 commands 暴露给其他 VSIX（`taichu.ai.session.*` / `taichu.ai.message.*` / `taichu.ai.attachment.upload` / `taichu.ai.model.switch` / `taichu.ai.a2ui.interact`）
  - OpenCode SSE 监听 + emitter 转发：业务 VSIX 通过 `window.addEventListener('taichu:opencode-event', ...)` 监听事件
- 业务 VSIX 通过 `taichu.fs.upload` command 上传图片/文件到沙箱工作区，再以附件 parts 发送给 AI

### 6. layout 控制

- TopBar 3 个 layout 按钮直连 `IMainLayoutService.toggleSlot`：
  - 左/右/底 panel 折叠/展开/拖拽 resize（OpenSumi 原生面板渲染器）
  - button icon 状态通过订阅 `TabbarService.onCurrentChange/onSizeChange` 同步
- 业务 VSIX 可调用这些 command ID 触发 layout 变更

## 单一职责边界

| 做 | 不做 |
|----|------|
| CodeBlitz 容器骨架（`AppRenderer` 装配） | 业务 VSIX 扩展 |
| slot / preferences / runtime 三类装配配置 | Agent 推理 / 工具调用 |
| **login** 槽位默认 webview（用户名/密码 mock） | 业务 VSIX 源码（统一在 `taichu/extensions/{name}/`） |
| **userPage** 槽位默认 webview（账号弹窗 + 退出登录） | OpenCode SDK 实例化（由 ai 相关 vsix 持有） |
| **fs** 框架能力（沙箱文件系统通道 + SandboxLoading） | A2UI 业务语义解析 |
| layout 折叠/展开控制（OpenSumi 原生） | 凭据硬编码 |
| 与 gateway / agent-image / registry 的接口契约 | 跨包直接 import |

## 内置 webview 与框架能力

client 除了渲染 IDE 骨架之外，承担 **3 个内置 webview**（login / userPage / rightbar-default）+ **1 个框架能力**（fs），分别落在 `components/{name}/`（webview 实现）与 `commands/{name}/`（命令注册与底层 api）+ `components/layout/fs/`（沙箱框架能力）。

### 1. login — 登录槽位默认 webview

- **槽位机制**：client 走 OpenSumi 标准 `<SlotRenderer slot="login">`；LayoutComponent 在 IDE 骨架外加 `<SlotRenderer slot="login">`，LoginView 自管 `position: fixed; inset: 0; z-index: 9999` 全屏 overlay 与显隐控制
- **显隐事件**：`taichu:login-show` / `taichu:login-hide` / `taichu:login-session-changed`（detail=session|null）
- **VS Code 扩展兼容标准**：自定义 login VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='login'`，由 client 框架按 VS Code 标准暴露）替换默认 LoginView，可加载 vsix 自带的 webview 渲染登录 UI
- **登录入口（TopBar）** 拆成两个独立按钮：
  - **登录** 按钮（未登录显示）：点击 → 派发 `taichu:login-show` → 触发 login overlay
  - **账号** 按钮（已登录显示，圆形头像）：点击 → 派发 `taichu:user-show` → 触发 userPage 弹窗
- **commands**（`commands/login/`，按工具集分组）：
  - `taichu.login.session.get` — 读当前 session
  - `taichu.login.session.set` — 写 session（Mock 登录或 OAuth 同步副本）
  - `taichu.login.session.clear` — 清 session（登出，跳 server logout 端点）
- **window 全局 API**：`window.__TAICHU_LOGIN_API__` 暴露同一份实现的直接调用入口
- OAuth 流程由 `server.ts` 承载；前端仅消费 `userId` / `tenantId` 注入全局（`window.__TAICHU_DEPLOY_CONFIG__`）
- gateway 命中已有沙箱 → 直接返回 `runtimeId` + `baseUrl`；未命中 → 创建 Pod → 等待 SSE: `READY` → 返回 `baseUrl`
- `baseUrl = http://{runtimeId}.{RUNTIME_HOST_SUFFIX}/agent/`，是后续 fs / ai 的前置条件

### 2. userPage — 账号槽位默认 webview

- **userPage 是浮动弹窗槽位**：TopBar 账号按钮点击 → 派发 `taichu:user-show` → LoginLayout 不参与；`<SlotRenderer slot="userPage">` 渲染 UserView 自管 `position: fixed; top: 44px; right: 12px; z-index: 9998` 弹窗
- **默认 webview**（`components/user/UserView.tsx`）：头部（头像 + 用户名 + Free 标识）+ 升级会员按钮 + 菜单列表（管理账号 / 消息 / 主题 / 检查更新 / 帮助文档 / 联系我们 / 报告问题）+ 退出登录按钮（客户端轻量清除，不跳 server logout 端点）
- **关闭机制**：点击弹窗外 / 按 Esc / `taichu:user-hide` 事件 / 退出登录
- **VS Code 扩展兼容标准**：自定义 userPage VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='userPage'`）替换默认 UserView，加载 vsix 自带的 webview 渲染真实用户信息 UI

### 3. fs — 沙箱文件系统通道（框架能力 + commands）

- login 拿到 `baseUrl` 后，fs 拓展**自动**访问 gateway 获取沙箱环境；环境可用时，自动激活 OpenSumi 文件系统对接沙箱
- **沙箱启动 loading**：login overlay 关闭后到沙箱就绪前显示 `SandboxLoading` overlay（`components/layout/fs/SandboxLoading.tsx`，监听 `taichu:fs-loading` / `taichu:fs-ready` / `taichu:fs-error` / `taichu:fs-teardown`）
- **OpenSumi sandbox scheme**：`SandboxFileSystemProvider` 注册 `sandbox:` scheme，把 IDE 文件操作映射到 `${agentApiBase}` 的 HTTP API
  - 读：`GET /file?path=...` 列目录 / `GET /file/content?path=...` 读文件
  - 写 / 创建 / 删除：`POST /pty` 派发 shell 脚本（`mkdir -p` / `touch` / `printf | base64` / `rm -rf`）；agent-image **不**暴露 `POST /file` 类 API，**不要**尝试加此假设
  - 沙箱内工作目录：`/workspace`（OpenCode 进程启动 cwd 与 fs 拓展工作区统一），IDE `workspaceDir: 'sandbox:/workspace'`
- 沙箱重建时 fs 通道自动重连
- **统一 fs API + commands 暴露给其它 client 拓展 / 业务 VSIX 使用**（`commands/fs/`，按工具集分组）：
  - `taichu.fs.list (path)` → `string[]`
  - `taichu.fs.read (path)` → `string`
  - `taichu.fs.write (path, content)` → `void`
  - `taichu.fs.create (path, type?)` → `void`
  - `taichu.fs.delete (path, opts?)` → `void`
  - `taichu.fs.upload (path, file, name?)` → `void`
- 跨拓展 IO 一律经 fs commands，不得直接 fetch `${baseUrl}/file...`；fs API 形状由 `commands/fs/api.ts` 的 `fsFetch` 统一封装
- **window 全局 API**：`window.__TAICHU_FS_API__` 暴露同一份实现的直接调用入口
- **上传接口**（图片 / 文件粘贴）：fs 拓展提供"上传到沙箱工作区"的能力，ai 相关 vsix 通过 `taichu.fs.upload` command 调用此接口实现粘贴上传

### 4. layout 控制

- TopBar 3 个 layout 按钮（左侧栏 / 底部栏 / 右侧栏）直连 `IMainLayoutService.toggleSlot`，由 OpenSumi 原生面板渲染器（`LeftTabRenderer` / `BottomTabRenderer` / `RightTabRenderer`）处理折叠/展开/拖拽 resize
- button icon 状态通过订阅 `TabbarService.onCurrentChange/onSizeChange` 同步
- 业务 VSIX 可通过 `commands.registerCommand` 注册 layout 触发的 command ID 触发 layout 变更

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
    ├── App.tsx               # AppRenderer 装配（注入三类 config + 内置拓展 Module）
    ├── index.html            # HTML 模板
    ├── components/           # 【webview 实现】各槽位的默认 UI，可被 VSIX 替换
    │   ├── login/            #   login 槽位默认 webview（用户名/密码登录）
    │   │   ├── LoginView.tsx
    │   │   └── index.ts      # LoginModule (BrowserModule + ComponentContribution)
    │   └── user/             #   userPage 槽位默认 webview（账号弹窗 + 退出登录）
    │       ├── UserView.tsx
    │       └── index.ts      # UserModule
    ├── commands/             # 【自定义拓展 commands】按工具集分组（与 config/ 同级）
    │   ├── login/            #   taichu.login.session.{get,set,clear} + session api
    │   │   ├── api.ts
    │   │   └── index.ts      # LoginCommandsContribution
    │   └── fs/               #   taichu.fs.{list,read,write,create,delete,upload} + fsFetch
    │       ├── api.ts
    │       └── index.ts      # FsCommandsContribution
    ├── components/layout/    # 【布局 + 框架能力】只维护 IDE 骨架与 slot 定义
    │   ├── layout.tsx        #   框架级 LayoutComponent（IDE 骨架 + slot 装配 + SandboxLoading）
    │   ├── index.ts          #   框架级模块统一导出
    │   ├── topbar/           #   top slot 容器（chrome + 3 layout toggle + 登录/账号按钮）
    │   ├── rightbar/         #   right slot 容器（面板 + 顶部 tab 横条，VSIX 注入 AI 等）
    │   ├── bottombar/        #   bottom slot 容器（默认 tc-problems）
    │   └── fs/               #   fs 槽位框架能力（runtime 拉取 + sandbox provider + SandboxLoading overlay）
    │       ├── api.ts        #   runtime 缓存 + 事件派发
    │       ├── runtime.ts    #   登录后激活沙箱
    │       ├── sandbox-fs.ts #   OpenSumi FileSystemProvider 实现
    │       ├── SandboxLoading.tsx  # 全屏 loading overlay
    │       └── index.ts      #   FsModule (BrowserModule, FsProviderContribution + ClientAppContribution)
    ├── config/               # 容器装配配置（按类型维护）
    │   ├── slots.ts          # layoutConfig（7 个 slot + login + userPage + builtin module）
    │   ├── preferences.ts    # defaultPreferences（主题 / 自动保存 / startup）
    │   └── runtime.ts        # runtimeConfig（框架级 filesystem）
    └── styles/               # 全局样式覆盖
        ├── overrides.css
        └── slots.css
```

> **目录约束**：
> - `components/` 只维护 webview UI，不写 commands；`commands/` 只维护命令注册与底层 api。两者通过共享 api（`commands/login/api.ts` 的 `writeSession` 等）和 window events 联动。
> - `components/layout/` 只维护 IDE 布局 + slot 定义 + 框架能力（fs runtime 拉取与 sandbox provider 注册）。slot 槽位里的默认 view 不在此处，view 在 `components/{name}/`，通过 slots.ts 槽位注册引用。
> - 任何"在 client 里加一段业务代码 / 业务命令"的请求，默认拒绝并下沉到对应内置 webview 或 commands 目录，或新建 `taichu/extensions/{name}/` VSIX 通过 registry 注入。

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
| gateway（数据平面） | 主域名 + 子域名 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` | `Host` 路由；fs / ai 数据流都走子域名 |
| agent-image（fs 通道） | `GET /file` / `GET /file/content` / `POST /pty` | `baseUrl = {runtimeId}.{RUNTIME_HOST_SUFFIX}/agent/`；读 HTTP / 写 PTY + shell |
| agent-image（OpenCode） | `global/events` SSE、`@opencode-ai/sdk` 客户端 | 由 ai 相关 vsix 封装，订阅 / 转发由 vsix 负责 |
| registry（拓展市场） | `GET /metadata.json` 拉清单 + `GET /vsix/{name}-{version}.vsix` 下载 VSIX 包 | 启动期一次 `registryClient.fetchMetadata()`；按清单从 CDN/OSS 下载后装入 `ExtensionService`（即 `runtimeConfig.extensionMetadata`）；示例功能 `yunyan-paper-web` 通过 registry 加载 |

## 边界约束

- 纯浏览器运行（`server.ts` 仅用于 OAuth + 静态托管 + 健康检查）；**生产无 Node.js 业务逻辑**。
- **不直连 K8s**、不解析 A2UI 业务语义、不存储 VSIX 包、不内置业务 VSIX 源码、不内置 OpenCode SDK（由 ai 相关 vsix 持有）。
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
- 沙箱 runtime 启动后到 OpenCode SDK 接入由 ai 相关 vsix 完成，client 仅负责 fs 通道（`SandboxFileSystemProvider`）；AI 流式交互的 OpenCode SDK 接入由 vsix 持有。