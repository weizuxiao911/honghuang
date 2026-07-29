# OpenSumi + opencode 前后端分离 Agent 调研

> 状态：**第一轮事实调研完成 + CodeBlitz 容器 POC 跑通** · 关联《架构设计.md》§2、§4.2、§4.3
> 目标：验证「OpenSumi 纯前端（容器编排交互 + 行为 vsix 扩展）+ opencode SDK 后端」能否组成前后端分离的云端 Agent。
> 原则：**以实测/源码为准，不臆断**。推测项明确标注「待验证」。

---

## 1. 结论摘要

- ✅ **opencode 提供官方 JS SDK**（`@opencode-ai/sdk` v1.18.8），三种入口：纯 HTTP 客户端、代码内起 server、一把起 server+client。后端接入不用手撸 HTTP。
- ✅ **前端内核选 CodeBlitz**（`@codeblitzjs/ide-core` 2.4.6，基于 OpenSumi 3.6.5 / react18，含 AI 原生模块）。文件系统（`DynamicRequest` 只读 + 保存回调写回）与扩展加载均为一等 API，优于停更的旧 lite 模板。
- ✅ **vsix 是唯一的业务交互载体**：CodeBlitz/OpenSumi 是**纯容器、零业务**，仅提供 IDE 骨架；**Agent 会话管理、对话窗口、工具/diff 展示、行为规范全部由 AgentNest vsix 承载**。容器保持通用不变，前端交互形态由 vsix 定义。
- ✅ **CodeBlitz 容器已本地跑通**（webpack5 + React18），`DynamicRequest` 只读接 opencode `/file`、`/file/content`，浏览器实测文件树 = 容器 `/workspace` 真实内容、编辑器读真实文件。见《poc/opensumi-web》。
- 🟡 **vsix 全链路加载、文件写回回路、BFF SSE 转发**：机制清晰但**尚未端到端 POC**，列入下一步。

---

## 2. opencode JS SDK 能力（实测，容器内 node_modules）

包：`@opencode-ai/sdk@1.18.8`，ESM，`exports` 提供 `.`/`./client`/`./server`/`./v2`。

### 三种入口（源码 .d.ts 证实）

| 函数 | 作用 | 用途 |
|------|------|------|
| `createOpencodeClient({ baseUrl, directory? })` | 纯 HTTP 客户端，连已有 server | **前后端分离首选**：连容器里的 opencode serve |
| `createOpencodeServer({ hostname, port, config })` | 代码内启动一个 server | 需要进程内托管时用 |
| `createOpencode(options)` | 一把起 server + 返回 client | 单体/本地开发 |

### client 覆盖度（方法名实测）

覆盖 session 全生命周期与交互闭环：`create/fork/abort/summarize/revert/unrevert/share`、`message/messages/prompt/promptAsync/command/shell`、`files/read/status/diff/symbols`、`event/subscribe`(SSE)、`agents/providers/auth/log/todo`、`tui.*`、权限响应等。

> 事实：SDK client 方法与 `/doc` 的 188 端点一一对应（SDK 由 OpenAPI 自动生成）。后端 Node 服务可直接 `import { createOpencodeClient }` 调用，无需关心 HTTP 细节。

---

## 3. 前端纯前端内核：CodeBlitz（企业级选型）

### 3.1 内核选型（实测版本核实）

| 方案 | 版本 | 基于 | 状态 | 结论 |
|------|------|------|------|------|
| **CodeBlitz** `@codeblitzjs/ide-core` | 2.4.6 | **OpenSumi 3.6.5** / react18 | 活跃维护 | ✅ **推荐**：官方主推纯前端封装，自带 `@opensumi/ide-ai-native`；文件系统与保存事件为一等 API |
| `ide-startup-lite` 模板 | OpenSumi 2.26.8 | react16 / webpack4 / ts3.8 | **2024-05 停更** | ❌ 过时；仅作机制参考，见附录 A |
| OpenSumi 主线 | 3.9.0 | react18 | 最新 | 需自行搭建 lite 集成，工作量大 |

- 事实：`@opensumi/core` 是 GitHub 仓库名，npm 无此包；发布物为 `@opensumi/ide-*`（最新 3.9.0）。
- CodeBlitz 依赖树里 OpenSumi 组件为 `3.6.5-next-*`，含 `ide-ai-native`，与 Agent 场景天然契合。

### 3.2 集成入口与构建工具链（实测跑通）

CodeBlitz 通过单一 React 组件装配整个 IDE：

```tsx
<AppRenderer appConfig={appConfig} runtimeConfig={runtimeConfig} />   // @codeblitzjs/ide-core
```

- `appConfig`：`IAppConfig extends Partial<IAppOpts>`，含 `workspaceDir`（工作空间目录，挂载到 `/workspace` 根）。
- `runtimeConfig: RuntimeConfig`（`@codeblitzjs/ide-sumi-core`）：运行时行为与文件系统接入点，是接 opencode 的核心。
- 底层 `renderApp(dom, props)` / `AppRenderer` / `AppProvider` 均导出自 `lib/api/renderApp`；`IAppRendererProps extends IConfig { appConfig; runtimeConfig }`（源码实测）。

**构建工具链（实测，非臆断）**：官方 sample 与本 POC 均用 **webpack 5 + ts-loader + React 18**，无 Vite 官方支持。关键约束：
- 必须副作用引入 `@codeblitzjs/ide-core/bundle/codeblitz.css` 与 `@codeblitzjs/ide-core/languages`。
- 必须配 **less-loader**（OpenSumi 组件含 `.less`，缺失则百余处 parse 报错）、node-polyfill（`process`/`Buffer`）、`path-browserify`、`experiments.asyncWebAssembly`。
- Monaco worker 默认从阿里云 CDN（`gw.alipayobjects.com`）加载，离线/受限网络会报 `importScripts` 失败；不影响渲染与文件读取，生产需本地化托管。

详见《poc/opensumi-web》。

### 3.3 文件系统接入（关键，源码实测）

CodeBlitz 用 **BrowserFS 风格的可挂载文件系统**（`@codeblitzjs/ide-browserfs`），由 `runtimeConfig.workspace.filesystem: FileSystemConfiguration` 配置。内置 backend（节选）：

| backend | 用途 | 对接 opencode |
|---------|------|---------------|
| **`DynamicRequest`** | 通用**只读** HTTP 文件系统，按需加载 | ✅ 直接接 opencode `/file*` |
| `OverlayFS` | 只读底层 + 可写上层叠加 | 读走 opencode，写走上层 + 回调落盘 |
| `IndexedDB` / `InMemory` | 浏览器本地缓存/内存 | 作可写层或离线缓存 |
| `MountableFileSystem` / `FolderAdapter` | 组合挂载 | 多源组合 |

**`DynamicRequest` 契约（实测 `DynamicRequest.d.ts`）** —— 只读，三个方法：

```ts
interface DynamicRequestOptions<T = any> {
  stat?(p: string, data?: T): FileStat | Promise<FileStat>          // 可选，缺省 size=-1 自动回填
  readDirectory(p: string, data?: T): FileEntry[] | Promise<...>    // 列目录
  readFile(p: string, data?: T): Uint8Array | Promise<Uint8Array>   // 读文件内容
}
```

映射 opencode：

| DynamicRequest 方法 | opencode 端点 | 前序验证 |
|---|---|---|
| `readDirectory(p)` | `GET /file?path=` | ✅ |
| `readFile(p)` | `GET /file/content?path=` | ✅ |
| `stat(p)` | `GET /file/status` 或读时回填 | 🟡 |

### 3.4 写回接入（比旧 lite 优雅，源码实测）

`DynamicRequest` 只读，**写回不走它**，而走 `runtimeConfig.workspace` 的事件回调 —— 这是 CodeBlitz 相比旧 lite「假写」的本质改进：

```ts
runtimeConfig.workspace = {
  filesystem,
  onDidSaveTextDocument({ filepath, content }) { /* → 写回 opencode */ },
  onDidChangeTextDocument({ filepath, content }) { /* 变更 */ },
  onDidCreateFiles(files: string[])   { /* 新建 */ },
  onDidDeleteFiles(files: string[])   { /* 删除 */ },
  onDidChangeFiles(data)              { /* 批量变更 */ },
}
```

- 编辑器里保存 → `onDidSaveTextDocument({filepath, content})` 触发 → BFF 把内容写回 opencode（§4 通道）。
- 相关开关：`disableModifyFileTree`（禁改文件树）、`scmFileTree`、`defaultOpenFile`、`startupEditor`。

### 3.5 vsix 扩展 —— 唯一的业务交互载体（源码实测）

> **架构定性（关键）**：CodeBlitz/OpenSumi 是一个**纯容器（shell），零业务**。它只提供编辑器、布局、扩展宿主等通用 IDE 骨架，**不含任何 AgentNest 业务逻辑**。
>
> **所有前端业务交互——包括 Agent 会话管理、对话窗口、任务/工具展示、diff、规范约束——全部由 vsix 扩展承载。** 容器本身保持通用、不含业务，前端交互形态完全由 vsix 定义（后端能力仍在 opencode）。
>
> 因此 vsix 不是「插件」意义上的可选增强，而是**业务层的全部**。这与 VSCode/Cursor/Trae 的思路一致：内核通用，产品性由扩展定义。

#### 3.5.1 职责边界
| 层 | 归属 | 内容 |
|----|------|------|
| 容器（CodeBlitz/OpenSumi） | 通用、无业务 | 编辑器、文件树、布局、扩展宿主、终端宿主、主题 |
| **业务（AgentNest vsix）** | **全部业务** | **Agent 会话管理、对话窗口、工具调用/任务展示、diff 交互、命令集、工作流规范** |
| 能力（opencode） | Agent 大脑 | 真正的对话/工具/文件执行，经 BFF 由 vsix 调用 |

- vsix 复用 **VSCode Extension API**，可直接沿用 VSCode 生态与开发范式。
- vsix 内**不含 Agent 推理逻辑**（那在 opencode）；它负责**会话状态管理 + UI 渲染 + 指令下发**，是业务交互的完整实现。
- 用到的扩展点：命令、菜单/快捷键、侧边栏视图、**Webview（对话窗口/Agent 面板/diff）**、终端、`activationEvents` 懒激活。

#### 3.5.2 纯前端下的加载机制（实测）
纯浏览器无文件系统扫描，CodeBlitz 采用**声明式元数据加载**（实测 `@codeblitzjs/ide-common` 的 `IExtensionBasicMetadata`）：

```ts
interface IExtensionBasicMetadata {
  extension: IExtensionIdentity                 // publisher/name/version
  packageJSON: {
    publisher; name; version
    activationEvents?: string[]                 // 懒激活
    contributes?: JSONType                      // VSCode 标准贡献点
    sumiContributes?: JSONType                  // OpenSumi 扩展贡献点(如自定义视图/布局)
    ...
  }
  webAssets: string[]                           // 扩展资源清单(js/css/媒体)
  uri?: string
  mode?: IExtensionMode
}
```

装配路径（实测）：
- `createApp({ appConfig })` 的 `appConfig.extensionMetadata: IExtensionBasicMetadata[]` 声明要加载的扩展。
- `appConfig.extensionOSSPath`（格式 `.../publisher.name-version`）指向扩展资源 CDN/OSS 基址。
- 构建期用 CodeBlitz CLI（`@codeblitzjs/ide-cli`）从 vsix 生成 `extensionMetadata` + `webAssets`，产物托管到 OSS/CDN。
- 运行时前端按 metadata 拉取 `webAssets` 激活扩展（含 Webview 资源）。

#### 3.5.3 AgentNest vsix 承载的业务（全部业务，非增强）
| 扩展点 | 承载业务 | 对接后端 |
|--------|----------|----------|
| Webview 视图 | **对话窗口、Agent 会话管理 UI**、任务/工具调用展示、diff 视图 | BFF → opencode SSE / message |
| 扩展进程逻辑 | **会话生命周期管理**（创建/切换/中断/历史） | BFF → opencode `/session/*` |
| commands | 统一命令集（新建会话、跑 Agent、应用改动） | BFF → opencode `/session/*` |
| 菜单/快捷键 | 规范开发行为、工作流引导 | 本地 UI |
| 终端视图 | 映射 opencode PTY | BFF → opencode `/pty` |
| activationEvents | 懒激活，降冷启动 | — |

#### 3.5.4 关键未知（POC 必验）
- CodeBlitz 声明式加载**自研 vsix**（含 Webview + 会话管理逻辑）的完整链路能否跑通（CLI 打包 → metadata → 运行时激活）。
- Webview 内如何与 BFF 建 SSE 长连接（跨域、CSP、消息桥）承载对话窗口实时流。
- 会话状态放在 vsix 扩展进程还是 Webview（刷新/重连恢复）。
- `sumiContributes` 能否满足自定义 Agent 面板布局（vs 标准 `contributes`）。

---

## 4. 写文件回路（承接 opencode-server-api 调研结论）

opencode **无直接写文件端点**。CodeBlitz 的 `onDidSaveTextDocument` / `onDidCreateFiles` / `onDidDeleteFiles` 回调需由 BFF 映射到 opencode 的间接落盘通道：

| 通道 | opencode 侧 | 已验证 | 备注 |
|------|-------------|--------|------|
| Agent write tool | `POST /session/:id/message` | ✅ | 走 Agent，非纯文件写 |
| PTY 终端 | `POST /pty` 跑 shell | ✅ | 直接落盘，通用 |
| 自研写端点 | fork opencode 加 `PUT /file` | ❌ | 最干净，改源码 |
| sidecar 直挂卷 | 后端独立文件服务共享 PVC | ❌ | 职责最清晰 |

> 人工编辑保存这条路径的**具体选型仍未定**，是本方案要 POC 的重点。

---

## 5. 目标架构（前后端分离）

```
浏览器
  └─ CodeBlitz 容器 (纯 IDE 骨架, 零业务, 基于 OpenSumi 3.6.5)
       └─ AgentNest vsix ◄══ 全部业务交互都在这里
            ├─ 对话窗口 + Agent 会话管理(创建/切换/中断/历史)
            ├─ Webview: 工具调用/任务/diff 展示
            ├─ commands / 菜单 / 快捷键: 规范开发行为
            └─ 终端视图: 映射 opencode PTY
       (容器另提供: 文件系统 DynamicRequest 只读 + 保存回调写回)
            读: /file, /file/content   写: PTY / Agent / 自研端点
                                   │
                                   ▼
                        桥接层 (BFF, Node)
                        @opencode-ai/sdk createOpencodeClient
                                   │  per-tenant 路由 + 鉴权 + SSE 转发
                                   ▼
                        opencode serve (Docker, 1C1G, 每租户独占)
                        工作区 = /workspace (卷挂载)
```

- **容器层**（CodeBlitz）：纯 IDE 骨架，无业务，可共享、可预热。
- **业务层**（AgentNest vsix）：**全部前端交互**，包括 Agent 会话管理与对话窗口。交互形态由 vsix 定义，容器保持通用。
- **桥接层 BFF**：`createOpencodeClient` 连租户 opencode 实例；做鉴权、per-tenant 路由、SSE 转发、把文件保存回调映射到 PTY/Agent 落盘。
- **能力层**（opencode Docker）：前序 POC 已验证可跑（1C1G、API 全通、扩展可挂载注入）。

---

## 6. 关键未验证点（下一步 POC）

- [x] CodeBlitz 容器本地跑起来（webpack5 + React18，构建工具链已验证；无 Vite 官方支持）—— 见《poc/opensumi-web》
- [x] 文件系统：`DynamicRequest.readDirectory/readFile` 接 opencode `/file`、`/file/content`（读通，文件树 = 真实工作区；大目录按需加载性能待压测）
- [ ] 写回路径：`onDidSaveTextDocument` → PTY/Agent 落盘后，编辑器状态一致性
- [ ] **vsix（核心）：CLI 打包自研扩展 → `extensionMetadata`/`webAssets` → 运行时激活 Webview 全链路**
- [ ] Webview 内与 BFF 建 SSE 长连接（跨域 / CSP / 消息桥 / 断线重连）
- [ ] 桥接层：`createOpencodeClient` + SSE 转发到浏览器
- [ ] Monaco worker 资源本地化托管（当前走阿里云 CDN，受限网络失败）
- [ ] 鉴权：`OPENCODE_SERVER_PASSWORD` + BFF token → per-tenant 路由

---

## 7. 已确立的可行性依据（不需再验证）

- opencode 打 Docker、1C1G 可跑、188 API 全通、扩展可注入 → 见《poc/opencode-docker》
- opencode 无写文件 API，但 PTY/Agent 可落盘 → 见《opencode-server-api调研.md》§4
- 沙箱边界由 K8s 容器提供，opencode 无需内部远程沙箱 → 见同上调研补充
- opencode 官方 SDK 覆盖全部端点 → 本文 §2

---

## 附录 A：旧 `ide-startup-lite` 模板（仅机制参考，不采用）

停更于 2024-05，OpenSumi 2.26.8 / react16 / webpack4。虽不采用，其源码揭示的机制对理解纯前端文件系统有参考价值：

- 用 `BrowserFsProvider` 替换本地 `DiskFileSystemProvider`，文件来自集成方实现的 HTTP 服务。
- 接入点是抽象基类 `AbstractHttpFileService`（`browser-fs-provider.ts:441`）：`readFile`/`readDir` 必须实现；`updateFile`/`createFile`/`deleteFile` 基类默认 `throw not implemented`。
- 默认实现走 **GitHub code-api 只读**，且 `update/create/delete` 只改浏览器内存（源码标注 `TODO: sync to remote logic`），**不落盘**——印证写回必须自建。
- 结论：CodeBlitz 的 `DynamicRequest` + 保存回调是同一思路的**更成熟封装**，故本方案采用 CodeBlitz。

---

*本文档随调研推进持续更新。*
