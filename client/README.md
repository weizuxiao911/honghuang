# app（交互平面）

> 交互平面底层容器宿主。OpenSumi/CodeBlitz 纯前端 IDE 骨架（零业务），全平台所有业务交互由 VSIX 承载。

详细职责、边界、与其它模块接口见 [`../设计文档.md`](../设计文档.md) 第一章「app（交互平面）」。

## 当前状态

本目录是 app 模块的正式工程位，包含：

- 容器骨架（`src/`）：CodeBlitz 入口、OpenSumi 配置外置、opencode 文件读写通道、扩展清单拉取
- 容器构建（`package.json` + `webpack.config.js` + `tsconfig.json`）
- 内置 VSIX 扩展（`extensions/`）：
  - `chat-window`：右侧对话窗口（直连 opencode SDK，SSE 实时更新）
  - `session-manager`：左侧会话管理（列出 / 新建 / 删除 / 切换 opencode 会话）

## 目录结构

```
app/
├── README.md
├── AGENTS.md
├── package.json                # taichu-app（CodeBlitz 容器构建）
├── tsconfig.json
├── webpack.config.js
├── .gitignore
├── src/                        # CodeBlitz 容器入口与配置
│   ├── index.tsx               # ReactDOM 入口
│   ├── App.tsx                 # AppRenderer 装配
│   ├── index.html              # HTML 模板
│   ├── config/
│   │   ├── codeblitz.config.ts # appConfig / runtimeConfig（外置）
│   │   └── layout.tsx
│   ├── services/
│   │   ├── opencode.ts         # opencode 文件客户端
│   │   └── registry.ts         # 扩展清单客户端
│   └── styles/
│       └── overrides.css
├── extensions/                 # 内置 VSIX 源码
│   ├── chat-window/            # 右侧对话窗口
│   │   ├── package.json        # name: app-chat-window
│   │   ├── tsconfig.json
│   │   ├── scripts/build.js
│   │   └── src/{extension.ts, views.tsx}
│   └── session-manager/        # 左侧会话管理
│       ├── package.json        # name: app-session-manager
│       ├── tsconfig.json
│       ├── scripts/build.js
│       └── src/{extension.ts, views.tsx, opencode.ts}
└── docs/
    └── ...（与 app 相关的协议契约）
```

## 启动方式

前置：opencode 后端已起（[agent-image](../agent-image/) 或本地 opencode-serve，默认 `http://127.0.0.1:4096`）。

```bash
cd app
npm install
npm run dev        # http://localhost:8888
```

后端地址可通过环境变量覆盖：

```bash
OPENCODE_BASE_URL=http://127.0.0.1:4096 npm run dev
EXTENSION_REGISTRY_URL=https://localhost:9000 npm run dev
```

扩展清单默认从 `https://localhost:9000`（[registry](../registry/)）拉取。

## 与其它模块的接口

- **VSIX 来源**：从 [`../registry/`](../registry/) 拉取业务插件清单与版本。
- **流式 UI 通道**：与 [`../agent-image/`](../agent-image/) 通过 [`../gateway/`](../gateway/) 网关建立 SSE 长连接，由对话类 VSIX 处理 A2UI 流式 UI 渲染。
- **交互指令**：非对话类插件通过标准 command 转发，不直连 agent-image。

## 边界约束

- 纯浏览器运行，**无** Node.js 运行时、无后端逻辑。
- 不直连 agent-image（生产环境）；本地验证可直连。
- 不硬编码服务凭据；鉴权 Header 由 gateway 网关注入。
- 插件之间**仅**通过全局 command 命令 ID 联动。

## UI 设计（待迭代）

当前 UI 设计：左侧 `session-manager`（搜索 + 新对话 + 时间分组列表 + 可折叠），右侧 `chat-window`（消息气泡 + 流式光标 + SSE 实时更新）。顶栏为项目级 IDE 标题栏。

UI 风格、交互细节、信息密度**待后续迭代**。

## 已知问题

详见 `src/` 内注释与 [`../docs/opensumi-opencode前后端分离调研.md`](../docs/opensumi-opencode前后端分离调研.md)：

- Monaco worker 走阿里云 CDN（离线/受限网络失败）
- 文件/目录判定用「扩展名」启发式（生产应改 stat 精确判断）
- IndexedDB 与 opencode 落盘对账策略未完善
- 重命名（删除+新建）行为待验证