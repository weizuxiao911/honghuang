# vsix 扩展开发标准调研（OpenSumi / CodeBlitz）

> 状态：**事实调研完成**（VSCode 官方文档 + OpenSumi 官方文档 + `@codeblitzjs/ide-*` 2.4.6 源码 + 实测）
> 目标：厘清在 AgentNest（CodeBlitz 纯前端容器）中，一个自研 vsix 扩展的**开发标准**——目录结构、manifest、入口、贡献点、激活、打包。
> 原则：**以实测/源码/官方文档为准，不臆断**。推测项明确标注「待验证」。
> 关联：《opensumi-opencode前后端分离调研.md》§3.5、《poc/agent-extensions》。

---

## 1. 结论摘要

- ✅ OpenSumi 扩展是 **VSCode 扩展的超集**：完全兼容 VSCode Extension API，另加 OpenSumi 独有的 Browser/Worker 扩展能力。
- ✅ **三入口，全部可选**：`main`（Node，VSCode 兼容）、`sumiContributes.workerMain`（Web Worker）、`sumiContributes.browserMain`（Browser 视图，OpenSumi 独有）。纯前端容器（CodeBlitz）**无 Node 进程**，只用 worker + browser。
- ✅ **业务交互载体 = browser + worker 双入口**：`browserMain` 用 React 渲染视图（left/right/bottom 面板），`workerMain` 跑逻辑；两者经 `sumi-browser` 的 `executeCommand` / `viewsProxies` 跨进程通信。
- ✅ **打包**：可用 VSCode 官方 `@vscode/vsce`，也可用 OpenSumi 官方 `@opensumi/cli`（`sumi package`）。产物均为 `.vsix`（zip 包）。
- ✅ **贡献点**：VSCode 标准 `contributes` + OpenSumi 扩展 `sumiContributes`（含 `browserViews`/`toolbar`/`viewsProxies` 等，共 13 类）。

---

## 2. 目录结构标准（OpenSumi 官方）

官方推荐结构（`opensumi.com/docs/extension/overview`）：

```
.
├── src
│  ├── extend
│  │  ├── browser        # Browser 入口：React UI 定制（OpenSumi 独有）
│  │  ├── node           # Node 入口：本地能力（纯前端容器不可用）
│  │  └── worker         # Worker 入口：WebWorker 计算
│  └── extension.ts      # VSCode 扩展入口（对应 main）
├── package.json         # 扩展 manifest
└── tsconfig.json
```

**三入口全部可选**：只要 VSCode 能力就只写 `extension.ts`；只要某一类 OpenSumi 能力就只写对应入口。

> AgentNest 实践（`poc/agent-extensions/session-manager`）：纯前端容器无 Node，采用 **`extension.ts`（worker 逻辑）+ `views.tsx`（browser 视图）** 双入口，esbuild 分别打包为 `out/extension.js` / `out/views.js`。入口文件名沿用 VSCode 惯例 `extension.ts`。

---

## 3. manifest（package.json）关键字段

### 3.1 标准字段（VSCode）
| 字段 | 说明 |
|------|------|
| `publisher` / `name` / `version` | 扩展身份，`publisher.name` 为唯一 ID |
| `engines` | 兼容声明。VSCode 扩展在 OpenSumi 运行时对齐特定 VSCode API 版本（如 OpenSumi 2.23.0 ≈ VSCode 1.68.0）；CodeBlitz 用 `engines.kaitian`/`opensumi` |
| `activationEvents` | 懒激活事件，如 `onCommand:*`、`onView:*`、`*`（启动即激活，官方警告影响性能） |
| `main` | Node 扩展入口（纯前端容器不生效） |
| `browser` | Web Extension 入口（VSCode Web Extension 规范） |
| `contributes` | VSCode 标准贡献点（commands/menus/configuration/keybindings…） |

### 3.2 OpenSumi 扩展字段 `sumiContributes`

实测源码（`codeblitz.global.js`）支持的 13 类贡献点 key：

```
workerMain      # Worker 入口路径
browserMain     # Browser 入口路径
nodeMain        # Node 入口路径（纯前端不用）
browserViews    # 声明 left/right/bottom 面板视图（核心）
viewsProxies    # 声明 browser 组件暴露给 node/worker 调用的方法代理
toolbar         # 工具栏 actions
menu / menubars / submenus   # 菜单扩展
properties / common / SCM / contributes
```

> 兼容：老扩展用 `kaitianContributes`，运行时会自动映射为 `sumiContributes`（实测 scanner + Extension 加载逻辑均做此兜底）。

### 3.3 `browserViews` 结构（实测）

```jsonc
"sumiContributes": {
  "workerMain": "./out/extension.js",
  "browserMain": "./out/views.js",
  "browserViews": {
    "left": {                       // left | right | bottom
      "type": "add",
      "view": [
        {
          "id": "agentnest.sessionManager",   // 关键：与 browser 导出组件名一致
          "icon": "comment-discussion",       // 内置 icon 名或 iconPath
          "title": "AgentNest 会话"
        }
      ]
    }
  }
}
```

**view.id 映射规则（源码实测 `activeExtensionContributes`）**：运行时按 `moduleExports[view.id]` 从 browserMain 导出里取对应 React 组件。因此 `browser` 入口须 `exports['agentnest.sessionManager'] = SessionManagerComponent`。

---

## 4. 双入口与通信（源码 + 官方文档实测）

| 环境 | 入口 | 模块名 | 能力 |
|------|------|--------|------|
| Browser | `browserMain` | `require('react')`（宿主注入）；`sumi-browser` | **仅视图渲染**；核心 API 是 `executeCommand`（跨进程调命令） |
| Worker | `workerMain` | `sumi-worker` / `sumi` | Node API 子集，**无 FS/ChildProcess/Terminal/Debug** |
| Node | `main` / `nodeMain` | `sumi` / `vscode` | 完整 VSCode + OpenSumi API（**CodeBlitz 纯前端无此进程**） |

**通信模型**：
- 官方定性：Browser 层「只为视图渲染，复杂业务逻辑应放 Node/Worker」。
- Browser → Worker：`executeCommand` 调用 worker 注册的命令（跨进程）。
- Worker → Browser：`sumiContributes.viewsProxies` 声明组件方法，Node/Worker 侧经 `context.componentProxy.<id>.<method>()` 调用 browser 组件（源码 133330 componentProxyIdentifier 机制）。

> POC 现状：`session-manager` 的 browser 面板出于最简，**直连 opencode `/session`**（CORS 已放行），未走 worker 代理。生产若需鉴权/会话状态集中，应把 opencode 调用挪到 worker，browser 经 executeCommand 取数。（待验证：worker 内 fetch opencode 的 CORS/权限表现）

---

## 5. 打包工具链（实测）

| 工具 | 命令 | 产物 | 备注 |
|------|------|------|------|
| `@vscode/vsce` | `vsce package` | `.vsix` | VSCode 官方；AgentNest POC 采用（3.9.2 实测通过） |
| `@opensumi/cli` | `sumi package` | `.vsix`/`.zip` | OpenSumi 官方；另有 `init/dev/watch/compile/bundle/publish/login` |

`.vsix` 本质是 zip，内含 `extension/package.json` + 产物文件 + `[Content_Types].xml` + `extension.vsixmanifest`。

AgentNest POC 打包实测（`session-manager`）：
- esbuild 打包 `extension.ts`→`out/extension.js`（external `vscode`）、`views.tsx`→`out/views.js`（external `react`）。
- `vsce package --no-dependencies --allow-missing-repository` 产出 3.9KB vsix。

---

## 6. 与 CodeBlitz 加载的衔接（详见分发调研）

开发产出 `.vsix` 后，CodeBlitz 纯前端加载需两步（详见《vsix扩展分发管理调研.md》）：
1. 构建期：解压 vsix → 扫描 `package.json` 生成 `IExtensionBasicMetadata`。
2. 运行时：`appConfig.extensionMetadata` 声明 → 按 `metadata.uri`（`kt-ext` 协议）拉取 browser/worker 资源激活。

---

## 7. 待验证

- [ ] worker 内 `fetch` opencode 的可行性（CORS、鉴权头传递）——决定业务逻辑放 worker 还是 browser。
- [ ] `viewsProxies` browser↔worker 双向代理在 CodeBlitz 2.4.6 的完整可用性。
- [ ] `activationEvents` 懒激活（`onView:`）在纯前端的实际触发时机（vs `*` 启动即激活）。
- [ ] `contributes.menus`/`keybindings` 等标准贡献点在 CodeBlitz 的生效范围。
- [ ] 多 vsix 共存时命令/视图 id 冲突处理。

---

*本文档随调研推进持续更新。*
