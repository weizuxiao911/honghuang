# 交互平面（client） AI 协作规则

> 本目录的 AI 工作约束。`README.md` 描述是什么；本文件约束怎么做。

## 单一职责

- 本模块只负责**交互平面**：CodeBlitz 容器骨架 + 三个内置拓展（login / fs / ai-panel）+ 业务 VSIX 通过 registry 加载注入。
- **能力归属**：fs 操作（文件读 / 写 / 上传）、AI 智能（OpenCode SDK 实例 + SSE 事件流）、登录状态（username / userId / avatarUrl）由 client **保留**——由 fs / ai-panel / login 三个内置拓展统一提供；其它业务 VSIX 必须通过 client 暴露的 commands 才能接入这些能力，不得直接 fetch `${baseUrl}/file...` 或 `${baseUrl}/global/events`，不得自己 `import { createOpencodeClient }`。
- **不**维护业务 VSIX 源码（业务 VSIX 源码统一在 `taichu/extensions/{name}/`，由 registry 上架；client 只通过 registry 客户端拉取并装载）、**不**内置 Agent 推理、**不**直接读写沙箱文件（除非通过 fs 拓展的统一接口）。
- 任何"在 client 里加一段业务代码 / 业务命令 / 业务状态机"的提问，默认答案：**不能**——下沉到对应内置拓展（`src/components/{name}/`）或新建 `taichu/extensions/{name}/` VSIX 通过 registry 注入。

## 技术栈与配置

- 内核：`OpenSumi` / `CodeBlitz`（`@codeblitzjs/ide-core`），纯前端；`server.ts` 仅用于生产环境的 OAuth + 静态托管 + 健康检查，不承载业务逻辑。
- 浏览器原生 `fetch` / `EventSource`（SSE）。
- `registryClient`（`registryClient.fetchMetadata()`）用于启动期拉 VSIX 元数据清单，按清单从 CDN/OSS 下载 `.vsix` 包后装入 `ExtensionService`。
- `@opencode-ai/sdk` 用于 ai-panel 拓展对接沙箱内 OpenCode 智能体。
- 配置外置：`layoutConfig` / `defaultPreferences` / `runtimeConfig` / `bootstrap`（如需）按类型维护在 `src/config/`，独立 `.ts` 文件，不散落代码里。
- **环境配置**：HOST 按环境划分维护，落在 `.env.{DEPLOY_ENV}`（dev / staging / production）；webpack 通过 `dotenv-webpack` 读 `.env.${DEPLOY_ENV}`，server.ts 通过 `dotenv` 读 `.env.${DEPLOY_ENV}`。`.env.example` 是模板（提交到 git）；`.env.development` / `.env.staging` / `.env.production` gitignore。

## 目录结构与拓展开发规范

### 顶层结构

```
client/src/
├── App.tsx              # AppRenderer 装配：注入三类 config + 内置拓展 Module
├── index.tsx            # ReactDOM 入口
├── index.html
├── components/          # 内置拓展（一个拓展一个目录，@opensumi/ide-core-browser 标准）
│   ├── topbar/          # 框架 chrome + AI 面板切换按钮
│   ├── login/           # 登录与会话建立
│   ├── fs/              # 沙箱文件系统通道
│   └── ai-panel/        # AI 侧栏（OpenCode 智能体对接）
├── config/              # 容器装配配置（三类，按类型维护）
│   ├── slots.ts
│   ├── preferences.ts
│   └── runtime.ts
└── styles/              # 全局样式覆盖
```

### 内置拓展开发规范

每个内置拓展落在 `src/components/{name}/`，**一个拓展一个目录**，目录内至少包含：

- `index.ts`：导出 `{Name}Module`（`BrowserModule`）与 `{Name}Contribution`（按 `@opensumi/ide-core-browser` 标记 `@Domain(ComponentContribution)` 等）
- 视图组件：拓展本身的 React 组件

**必须**按 `@opensumi/ide-core-browser` 标准开发：

- Module 通过 `appConfig.modules: [{Name}Module]` 注入 DI 容器（`App.tsx` 统一注册）
- Contribution 通过 `@Domain(...)` 装饰器声明，由 DI 的 `createContributionProvider` 自动收集
- 视图注册走 `ComponentRegistry.register(id, { id, component })`，由 `slot.ts` 的 `layoutConfig[SlotLocation.*].modules` 字符串 id 挂到目标 slot

### 命名约定

- 目录名：英文小写、连字符或驼峰，按业务语义（如 `topbar` / `login` / `fs` / `ai-panel`）
- Module / Contribution / 组件名：PascalCase（如 `TopBarModule` / `TopBarContribution` / `TopBar`）
- slot 模块 id：与 Module 同名（小写），在 `slots.ts` 中以字符串形式引用

### 配置装配

`App.tsx` 是**唯一**的容器装配入口：

- `appConfig`：合并三类配置 + `modules: [TopBarModule, LoginModule, FsModule, AiPanelModule, ...]`
- `runtimeConfig`：框架级 filesystem / 启动参数；`extensionMetadata` 字段由启动期 `registryClient.fetchMetadata()` 拉取的清单填充
- 不在 `App.tsx` 内做**业务**运行时副作用（写业务状态机、调业务命令）；**启动期副作用**（拉 VSIX 清单、起 SSE、跑 bootstrap）收敛到对应拓展的 Module / Contribution `onStart` / `onDidStart` 钩子，或 `index.tsx` 的 `ReactDOM.createRoot` 之前。

## 三个内置服务的约束

### login

- **默认实现 + 可被 VSIX 替换**：login 拓展是 client 默认登录交互（GitHub OAuth）；自定义登录页面 VSIX 可替换默认实现，但必须通过 client 暴露的 commands 读写登录状态——login 与登录页面 VSIX 职责分离
- **登录状态数据模型**：`username`（用户名）/ `userId`（用户唯一标识）/ `avatarUrl`（用户头像 URL）
- **拓展加载 + 状态传递**：用户访问入口时，client 自动从 registry 加载业务 VSIX 并将登录状态注入；未登录则跳转 `/auth/github/login`（或自定义登录页面 VSIX 提供的入口）
- OAuth 流程由 `server.ts` 承载；前端仅消费 `userId` / `tenantId` 注入全局（`window.__TAICHU_DEPLOY_CONFIG__`）
- 拿到 `userId` 后向 gateway 发起 `POST /runtime`，**必须**带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头；返回 `baseUrl` 后通知 fs / ai-panel 拓展消费
- 不在 login 拓展内做 SDK 实例化、不直连沙箱；职责收敛在"会话建立 + baseUrl 下发 + 登录状态读写 commands"

### fs

- **自动激活 OpenSumi 文件系统对接沙箱**：login 拿到 `baseUrl` 后，fs 拓展自动访问 gateway 获取沙箱环境；环境可用时激活 OpenSumi 文件系统，让 `@opensumi/ide-explorer` 等内置模块能直接访问沙箱内的文件 / 目录
- **统一 fs API + commands 暴露给其它 client 拓展 / 业务 VSIX**：跨拓展 IO 一律经 fs 客户端，commands 命名为 `taichu.fs.{action}`（读 / 写 / 建 / 删 / 上传）；不得直接 fetch `${baseUrl}/file...`
- 读：HTTP `GET /file?path=...` / `GET /file/content?path=...`
- 写 / 创建 / 删除：`POST /pty` 派发 shell 脚本（`mkdir -p` / `touch` / `printf | base64` / `rm -rf`）；agent-image **不**暴露 `POST /file` 类 API，**不要**尝试加此假设
- 不在 fs 拓展内做 OpenCode SDK 对接、不解析 A2UI、不持久化用户业务数据
- 上传接口（图片 / 文件粘贴）：fs 拓展提供"上传到沙箱工作区"的能力，ai-panel 拓展通过 `taichu.fs.upload` command 调用此接口实现粘贴上传

### ai-panel

- **自动接入沙箱内 OpenCode**：拿到 `baseUrl` 后，自动用 `@opencode-ai/sdk` 实例化客户端，SDK 生命周期由 ai-panel 持有
- **SDK 实例封装为 commands 暴露给其他 VSIX**：业务 VSIX 通过 commands 调用（不直接 `import { createOpencodeClient }`）：
  - `taichu.ai.session.create` / `taichu.ai.session.list` / `taichu.ai.session.switch`
  - `taichu.ai.message.send` / `taichu.ai.message.stream`
  - `taichu.ai.attachment.upload`（走 fs 通道写入沙箱）
  - `taichu.ai.model.switch`
  - `taichu.ai.a2ui.interact`（A2UI 交互控制）
- **OpenCode SSE 监听 + emitter 转发**：client 内监听 `${baseUrl}/global/events`，通过 `window` event emitter 推送（事件类型：`message.updated` / `message.part.updated` / `session.status` / `session.idle` / `session.error` / A2UI 等）；其他 VSIX 通过 `window.addEventListener('taichu:opencode-event', ...)` 监听；不绕过 SDK 直接 fetch `${baseUrl}/global/events`
- **A2UI 交互控制**：当 Agent 生成 `xxx.paper` 等业务资产时，ai-panel 通过 A2UI 事件通知相关拓展接管渲染（示例：`yunyan-paper-web` 收到 A2UI 触发后加载并显示 `xxx.paper` 文件）
- **功能边界**（必须严格遵守）：
  - **新会话**：当前会话为空不重复创建；当前会话运行中**必须**二次确认后才新建
  - **历史会话**：弹窗列出历史会话，点击切换；交互与新会话一致（空会话不重复创建 / 运行中二次确认）
  - **消息发送**：文字 / 图片 / 文件输入 / 粘贴；图片与文件粘贴走 fs 拓展的"上传"通道（`taichu.fs.upload`）写入沙箱，再以附件 parts 发送给 AI
  - **消息列表**：用户消息在右侧，AI 回复在左侧
- **不**实现会话列表侧栏（"历史会话"按钮弹窗已覆盖）；**不**实现设置等超出 AI 侧栏边界的 UI；layout 切换由 layout 控制命令（`taichu.layout.*`）统一处理

## 与其它模块的契约

- **禁止**跨包直接 import 其它模块代码（`extensions/` / `gateway/` / `agent-image/` / `registry/`）。
- 拓展与拓展、拓展与容器之间只通过 **OpenSumi 全局 command ID** 或 `window` 事件总线联动。
- 与 agent-image 的所有数据通道**必须**经 gateway（控制平面走 `POST /runtime`，数据平面走 `{runtimeId}.{RUNTIME_HOST_SUFFIX}` 子域名反代），不允许在生产环境直连 agent-image Pod IP。
- 业务 VSIX 通过 `registryClient.fetchMetadata()` 拉取元数据清单，从 CDN/OSS 下载 `.vsix` 后装入 `ExtensionService`；client **不**维护业务 VSIX 源码。
- 鉴权 Header（`X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` / `X-Runtime-Id`）由 gateway 注入并透传，client 不硬编码凭据。
- **HOST 按环境划分**：gateway / registry / runtime 子域的 HOST 落在 `.env.{DEPLOY_ENV}`，dev / staging / prod 三个环境独立维护；不得在源码 / K8s ConfigMap 中硬编码环境相关 HOST。

## 一致性义务

任何对本目录的修改必须保持与以下文件不互相矛盾：

- [`../功能设计.md`](../功能设计.md)（产品蓝图）
- [`../架构设计.md`](../架构设计.md)（技术蓝图）
- [`../README.md`](../README.md)（项目总览）
- [`../AGENTS.md`](../AGENTS.md)（项目治理）

修订前先读这四份，修订后核对其余四份（铁律 10 一致性核验）。

## 直接做 / 必须 question

按根 [`../AGENTS.md`](../AGENTS.md) 的「明显 vs 可能争议」执行。本目录落地：

**直接做**：

- 修复本目录内的拼写 / 格式 / 注释错误
- 在 `src/components/{topbar,login,fs,ai-panel}/` 范围内补全 / 重构已有拓展的代码
- 调整 `src/styles/` 下非语义的样式参数
- 调整 `k8s/deploy.yaml` 中非语义参数（副本数、timeout、CPU/Mem）
- 收敛旧命名（铁律 9）至 `client/` 等

**必须用 `question` 确认**：

- 新增 / 删除内置拓展（`src/components/` 下新增目录、移除 `topbar` / `login` / `fs` / `ai-panel` 中任一个）
- 改三个内置服务的对外契约（fs API 形状、ai-panel SDK 用法、login 头注入语义）
- 改 `src/config/` 三类配置的结构（如新增配置类型、改动 `layoutConfig` slot 注册方式）
- 引入新依赖（如新增 `@opencode-ai/sdk` 之外的 SDK）
- 跨模块 / 跨拓展的协议变更（如窗口事件总线名替换、新增全局 command ID 规范）
- 任何"是否争议 / 可能争议"的决策（命名、文件位置、API 设计、错误处理策略、依赖升级范围）
- **任何 git commit / push / rebase / reset / tag**（铁律 11 已固化）