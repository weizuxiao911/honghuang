# 交互平面（client） AI 协作规则

> 本目录的 AI 工作约束。`README.md` 描述是什么；本文件约束怎么做。

## 单一职责

- 本模块只负责**交互平面**：CodeBlitz 容器骨架 + 内置 webview 槽位（login / userPage）+ 内置框架能力（fs 沙箱通道）+ 业务 VSIX 通过 registry 加载注入。
- **能力归属**：
  - 登录会话（username / userId / avatarUrl）由 `commands/login/` 维护，供 webview + 其他拓展通过 commands 访问
  - 沙箱文件系统（baseUrl + 沙箱 IO）由 `components/layout/fs/` 维护（框架能力，非 webview），commands 在 `commands/fs/`
  - 其它业务 VSIX 必须通过 client 暴露的 commands 才能接入这些能力，不得直接 fetch `${baseUrl}/file...` 或 `${baseUrl}/global/events`，不得自己 `import { createOpencodeClient }`
- **不**维护业务 VSIX 源码（业务 VSIX 源码统一在 `taichu/extensions/{name}/`，由 registry 上架；client 只通过 registry 客户端拉取并装载）、**不**内置 Agent 推理、**不**直接读写沙箱文件（除非通过 fs 拓展的统一接口）。
- 任何"在 client 里加一段业务代码 / 业务命令 / 业务状态机"的提问，默认答案：**不能**——下沉到对应内置拓展（`src/commands/` 或 `src/components/{name}/`）或新建 `taichu/extensions/{name}/` VSIX 通过 registry 注入。

## 技术栈与配置

- 内核：`OpenSumi` / `CodeBlitz`（`@codeblitzjs/ide-core`），纯前端；`server.ts` 仅用于生产环境的 OAuth + 静态托管 + 健康检查，不承载业务逻辑。
- 浏览器原生 `fetch` / `EventSource`（SSE）。
- `registryClient`（`registryClient.fetchMetadata()`）用于启动期拉 VSIX 元数据清单，按清单从 CDN/OSS 下载 `.vsix` 包后装入 `ExtensionService`。
- `@opencode-ai/sdk` 用于 ai 相关 vsix 拓展对接沙箱内 OpenCode 智能体（client 不内置 ai-panel，业务方通过 vsix 注入 right 槽位）。
- 配置外置：`layoutConfig` / `defaultPreferences` / `runtimeConfig` / `bootstrap`（如需）按类型维护在 `src/config/`，独立 `.ts` 文件，不散落代码里。
- **环境配置**：HOST 按环境划分维护，落在 `.env.{DEPLOY_ENV}`（dev / staging / production）；webpack 通过 `dotenv-webpack` 读 `.env.${DEPLOY_ENV}`，server.ts 通过 `dotenv` 读 `.env.${DEPLOY_ENV}`。`.env.example` 是模板（提交到 git）；`.env.development` / `.env.staging` / `.env.production` gitignore。

## 目录结构与维护规则

### 顶层结构

```
client/src/
├── App.tsx              # AppRenderer 装配：注入 config + 内置拓展 Module
├── index.tsx            # ReactDOM 入口
├── index.html
├── components/          # 【webview 实现】各槽位的默认 UI，可被 VSIX 替换
│   ├── login/           #   login 槽位默认 webview（用户名/密码登录）
│   └── user/            #   userPage 槽位默认 webview（账号弹窗）
├── commands/            # 【自定义拓展 commands】按工具集分组（与 config/ 同级）
│   ├── login/           #   taichu.login.session.{get,set,clear} + session api
│   └── fs/              #   taichu.fs.{list,read,write,create,delete,upload} + fsFetch
├── components/layout/   # 【布局 + 框架能力】只维护 IDE 骨架与 slot 定义
│   ├── layout.tsx       #   框架级 LayoutComponent（IDE 骨架 + slot 装配）
│   ├── index.ts         #   框架级模块统一导出
│   ├── topbar/          #   top slot 容器（chrome + 3 个 layout toggle + 登录/账号按钮）
│   ├── rightbar/        #   right slot 容器（面板 + 顶部 tab 横条，VSIX 注入 AI 等）
│   ├── bottombar/       #   bottom slot 容器（默认 tc-problems）
│   └── fs/              #   fs 槽位框架能力（runtime 拉取 + sandbox provider + SandboxLoading overlay）
├── config/              # 容器装配配置（按类型维护）
│   ├── slots.ts
│   ├── preferences.ts
│   └── runtime.ts
└── styles/              # 全局样式覆盖
```

### 维护规则（重要）

- **`components/`** 只维护 webview UI，不写 commands；`commands/` 只维护命令注册与底层 api（fsFetch、session），不写 UI。两者通过共享 api（`commands/login/api.ts` 的 `writeSession` 等）和 window events 联动。
- **`components/layout/`** 只维护 IDE 布局 + slot 定义 + 框架能力（fs runtime 拉取与 sandbox provider 注册）。slot 槽位里的默认 view 不在此处，view 在 `components/{name}/`，通过 slots.ts 槽位注册引用。
- **`commands/{toolset}/`** 按工具集分组，每个工具集一个目录，含 `index.ts`（CommandsContribution 注册）+ `api.ts`（底层实现）。
- 一个 BrowserModule 一类职责，注入 `appConfig.modules: [...]`。

### 槽位 slot 概念

IDE 框架暴露的槽位（与 left/right/bottom/top 一致走 OpenSumi 标准 SlotRenderer）：

| 槽位 id | 位置 | 默认 view 来源 | 形态 | 可被 VSIX 替换 |
|---|---|---|---|---|
| `top` | 顶部 chrome | `components/layout/topbar/` | 36px 高 chrome | ✗（框架级 chrome） |
| `left` | 左侧 Primary Side Bar | `@opensumi/ide-explorer` / `@opensumi/ide-search` | 面板 | ✓ via `contributes.views` |
| `right` | 右侧 Secondary Side Bar | `components/layout/rightbar/` + 右栏容器 | 面板 + 顶部 tab 横条 | ✓ via `contributes.views` |
| `bottom` | 底部 Panel | `components/layout/bottombar/`（tc-problems） | 面板 | ✓ |
| `main` | 中央编辑区 | `@opensumi/ide-editor` | 编辑器 | ✗ |
| `login` | 全屏 overlay | `components/login/`（LoginView） | 浮层 fixed z-index:9999 | ✓ via `contributes.views+viewsContainers` |
| `userPage` | 顶部右下浮动弹窗 | `components/user/`（UserView） | 弹出 fixed top:44 right:12 z-index:9998 | ✓ |

注意 slot id 必须用标准 id（`left`/`right`/`bottom`），不能用 `@deprecated` 别名 `leftBar`/`rightBar`/`bottomBar`（这些别名 OpenSumi 没注册面板渲染器，会失去折叠/展开能力）。

### 内置拓展开发规范

- Module 通过 `appConfig.modules: [{Name}Module]` 注入 DI 容器（`App.tsx` 统一注册）
- Contribution 通过 `@Domain(...)` 装饰器声明，由 DI 的 `createContributionProvider` 自动收集
- 视图注册走 `ComponentRegistry.register(id, { id, component, options: { containerId, iconClass, title } })`，由 `config/slots.ts` 的 `layoutConfig[slot].modules` 字符串 id 挂到目标 slot（tabbar 容器需 `options.containerId`）
- Commands 注册走 `commands.registerCommand({ id }, { execute })`，由 `CommandsContribution.registerCommands(commands)` 注册

### 命名约定

- 目录名：英文小写、连字符或驼峰，按业务语义（如 `topbar` / `rightbar` / `login` / `user`）
- Module / Contribution / 组件名：PascalCase（如 `TopBarModule` / `LoginContribution` / `LoginView`）
- slot 模块 id：与 Module 同名（小写），在 `slots.ts` 中以字符串形式引用
- command id：`taichu.{toolset}.{action}` 小写（如 `taichu.login.session.get`、`taichu.fs.read`）
- window event：`taichu:{domain}-{event}`（如 `taichu:login-show`、`taichu:fs-ready`）

### 配置装配

`App.tsx` 是**唯一**的容器装配入口：

- `appConfig`：合并三类 config + `modules: [TopBarModule, LoginModule, LoginCommandsModule, UserModule, FsModule, FsCommandsModule, BottomModule, RightBarModule]`
- `runtimeConfig`：框架级 filesystem / 启动参数；`extensionMetadata` 字段由启动期 `registryClient.fetchMetadata()` 拉取的清单填充
- 不在 `App.tsx` 内做**业务**运行时副作用；**启动期副作用**（拉 VSIX 清单、起 SSE、跑 bootstrap）收敛到对应拓展的 Module / Contribution `onStart` / `onDidStart` 钩子，或 `index.tsx` 的 `ReactDOM.createRoot` 之前。

## 三个内置服务的约束

### login（webview + commands）

- **login 是一个槽位（slot）**：client 走 OpenSumi 标准 `<SlotRenderer slot="login">` 渲染；LayoutComponent 在 IDE 骨架外加 `<SlotRenderer slot="login">`，LoginView 自管 `position: fixed; inset: 0; z-index: 9999` 全屏 overlay 与显隐控制
- **VS Code 扩展兼容标准（铁律 12）**：自定义 login VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='login'`，由 client 框架按 VS Code 标准暴露）替换默认 LoginView，可加载 vsix 自带的 webview 渲染登录 UI
- **登录状态数据模型**：`username` / `userId` / `avatarUrl`，由 `commands/login/api.ts` 的 `readSession/writeSession/clearSession` 维护
- **登录态 events**：`taichu:login-show`（显示 overlay）/ `taichu:login-hide`（隐藏）/ `taichu:login-session-changed`（session 写入/清除，含登出；detail=session|null）
- **登录入口（TopBar）** 拆成两个独立按钮：
  - **登录** 按钮（未登录显示）：点击 → 派发 `taichu:login-show` → 触发 login overlay
  - **账号** 按钮（已登录显示，圆形头像）：点击 → 派发 `taichu:user-show` → 触发 userPage 弹窗（账号信息 + 退出登录）
- **commands**（`commands/login/index.ts`）：
  - `taichu.login.session.get` — 读当前 session
  - `taichu.login.session.set` — 写 session（Mock 登录或 OAuth 同步副本）
  - `taichu.login.session.clear` — 清 session（登出，跳 server logout 端点）
- **window 全局 API**：`window.__TAICHU_LOGIN_API__` 暴露同一份实现的直接调用入口
- OAuth 流程由 `server.ts` 承载；前端仅消费 `userId` / `tenantId` 注入全局（`window.__TAICHU_DEPLOY_CONFIG__`）
- 不在 login webview 内做 SDK 实例化、不直连沙箱；职责收敛在"会话建立 + 槽位注册默认 view + 登录状态读写 commands"

### userPage（webview）

- **userPage 是浮动弹窗槽位**：TopBar 账号按钮点击 → 派发 `taichu:user-show` → LoginLayout 不参与；`<SlotRenderer slot="userPage">` 渲染 UserView 自管 `position: fixed; top: 44px; right: 12px; z-index: 9998` 弹窗
- **默认 webview**（`components/user/UserView.tsx`）：头部（头像 + 用户名 + Free 标识）+ 升级会员按钮 + 菜单列表（管理账号 / 消息 / 主题 / 检查更新 / 帮助文档 / 联系我们 / 报告问题）+ 退出登录按钮（客户端轻量清除，不跳 server logout 端点）
- **关闭机制**：点击弹窗外 / 按 Esc / `taichu:user-hide` 事件 / 退出登录
- **VS Code 扩展兼容标准**：自定义 userPage VSIX 通过 `contributes.views` + `contributes.viewsContainers` 注册自定义 view container（`type='userPage'`）替换默认 UserView，加载 vsix 自带的 webview 渲染真实用户信息 UI（铁律 12）

### fs（框架能力 + commands）

- **自动激活 OpenSumi 文件系统对接沙箱**：登录成功（`taichu:login-session-changed` 带 detail=session）后，`components/layout/fs/runtime.ts` 派发 `taichu:fs-loading` → POST `${gateway}/runtime`（带 `X-User-Id` / `X-Tenant-Id` / `X-Deploy-Env` 头）创建 runtime → 拿到 RuntimeSnapshot.agentApiBase → 派发 `taichu:fs-ready`
- **沙箱启动 loading**：login overlay 关闭后到 `taichu:fs-ready` 之间显示 `SandboxLoading` overlay（spinner + "加载 sandbox 中,预计需等待 3~10s" 提示）；错误态显示红色卡片 + 重试 / 退出登录按钮
- **OpenSumi sandbox scheme**：`SandboxFileSystemProvider` 注册 `sandbox:` scheme，把 IDE 文件操作映射到 `${agentApiBase}` 的 HTTP API：
  - 读：`GET /file?path=...` / `GET /file/content?path=...`
  - 写 / 创建 / 删除：`POST /pty` 派发 shell 脚本（`mkdir -p` / `touch` / `printf | base64` / `rm -rf`）；agent-image **不**暴露 `POST /file` 类 API，**不要**尝试加此假设
- **沙箱内工作目录**：`/workspace`（OpenCode 进程启动 cwd 与 fs 拓展工作区统一），IDE `workspaceDir: 'sandbox:/workspace'`
- **commands**（`commands/fs/index.ts`，按工具集分组）：
  - `taichu.fs.list (path)` → `string[]`
  - `taichu.fs.read (path)` → `string`
  - `taichu.fs.write (path, content)` → `void`
  - `taichu.fs.create (path, type?)` → `void`
  - `taichu.fs.delete (path, opts?)` → `void`
  - `taichu.fs.upload (path, file, name?)` → `void`
- **window 全局 API**：`window.__TAICHU_FS_API__` 暴露同一份实现的直接调用入口
- **跨拓展 IO 一律经 fs commands**：不得直接 fetch `${baseUrl}/file...`；fs API 形状由 `commands/fs/api.ts` 的 `fsFetch` 统一封装
- 不在 fs 拓展内做 OpenCode SDK 对接、不解析 A2UI、不持久化用户业务数据
- 上传接口（图片 / 文件粘贴）：fs 拓展提供"上传到沙箱工作区"的能力，ai 相关 vsix 通过 `taichu.fs.upload` command 调用此接口实现粘贴上传

### SandboxLoading（fs 框架能力的 UI 状态）

- 由 `components/layout/fs/SandboxLoading.tsx` 渲染，挂在 LayoutComponent 内 IDE 骨架旁（与 login / userPage 槽位同级）
- 监听 `taichu:fs-loading` / `taichu:fs-ready` / `taichu:fs-error` / `taichu:fs-teardown` 四个事件，渲染对应状态（loading / ready=hidden / error=错误卡 / teardown=hidden）
- 半透明 backdrop + 居中卡片，不打断 IDE 骨架

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
- 在 `src/components/{layout/{topbar,rightbar,bottombar,fs},login,user}/` 范围内补全 / 重构已有拓展的代码
- 在 `src/commands/{login,fs}/` 范围内补全 / 重构已有 command 注册与底层 api
- 调整 `src/styles/` 下非语义的样式参数
- 调整 `k8s/deploy.yaml` 中非语义参数（副本数、timeout、CPU/Mem）
- 收敛旧命名（铁律 9）至 `client/` 等

**必须用 `question` 确认**：

- 新增 / 删除内置 webview（`src/components/{login,user}/` 下新增目录、移除任一个）
- 新增 / 删除 commands 工具集（`src/commands/` 下新增 / 移除整个 `{toolset}/` 目录）
- 改 `src/config/` 三类配置的结构（如新增配置类型、改动 `layoutConfig` slot 注册方式、新增槽位 id）
- 改内置服务的对外契约（fs API 形状、login 头注入语义、commands 命名规范）
- 引入新依赖（如新增 `@opencode-ai/sdk` 之外的 SDK）
- 跨模块 / 跨拓展的协议变更（如窗口事件总线名替换、新增全局 command ID 规范）
- 任何"是否争议 / 可能争议"的决策（命名、文件位置、API 设计、错误处理策略、依赖升级范围）
- **任何 git commit / push / rebase / reset / tag**（铁律 11 已固化）