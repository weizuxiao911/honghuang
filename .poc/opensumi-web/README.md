# opensumi-web — CodeBlitz 纯前端 IDE 容器 POC

> 目标：验证 CodeBlitz（OpenSumi 3.6.5 内核）能在本地跑起来，读写 opencode 后端的真实工作区。
> 状态：**读写全链路已跑通**（IDE 渲染 + 文件树/编辑器读真实内容 + 编辑保存经 PTY 写回落盘）。

## 已验证结论（实测）

| 项 | 结论 | 验证方式 |
|----|------|----------|
| 构建工具链 | webpack 5 + ts-loader + React 18（**非 Vite**，官方 sample 亦用 webpack） | `npm run dev` 编译 0 error |
| 入口 API | `<AppRenderer appConfig={} runtimeConfig={} />`（`@codeblitzjs/ide-core`） | 源码 `lib/api/renderApp.d.ts` |
| 必需副作用引入 | `import '@codeblitzjs/ide-core/bundle/codeblitz.css'` + `/languages` | 官方 sample + 实跑 |
| 必需 loader | less-loader（OpenSumi 组件含 `.less`）、node-polyfill（process/Buffer）、path-browserify、`asyncWebAssembly` | 缺 less-loader 时 132 报错 |
| 读文件 | `DynamicRequest`（只读）`readDirectory`/`readFile` 接 opencode `/file`、`/file/content` | 浏览器实测文件树 = 容器 `/workspace` 真实内容 |
| 可写文件系统 | `OverlayFS`（只读 `DynamicRequest` 底层 + `IndexedDB` 可写上层）；纯 `DynamicRequest` 编辑器只读，无法保存 | 换 OverlayFS 后「只读」告警消失、可编辑保存 |
| **写回落盘** | 保存 → `onDidSaveTextDocument({filepath, content})` → PTY 执行 `base64 -d > 绝对路径` | 改 seed.txt 保存后，容器内 `cat /workspace/seed.txt` = 编辑器内容（含中文） |
| PTY 写回安全性 | 内容经 **base64 传递**（不进命令行明文），引号/`$VAR`/反引号/中文/多行均原样落盘 | curl 直测 base64 管道方案 |
| 新建/删除写回 | `onDidCreateFiles`→`touch`/`mkdir`，`onDidDeleteFiles`→`rm -rf`，均经 PTY | 浏览器新建 note.md(regular file)、test3(directory)、删除 note.md，容器 `stat`/`ls` 一致 |
| 自动保存 | `editor.autoSave: afterDelay` + `autoSaveDelay: 1000`，编辑后 1s 自动触发写回，无需 Cmd+S | 源码枚举 `off/afterDelay/editorFocusChange/windowLostFocus` |
| opencode CORS | 默认**反射任意 Origin** 全放行（非仅限某端口） | `curl -H "Origin: http://localhost:8888"` 返回同源放行 |

## 目录结构（标准 React 工程）

```
opensumi-web/
  public/index.html            # HTML 模板（#root 挂载点）
  src/
    index.tsx                  # ReactDOM 入口
    App.tsx                    # 根组件：装配 AppRenderer
    config/codeblitz.config.ts # CodeBlitz 配置外置（appConfig / runtimeConfig + 读写回调）
    services/opencode.ts       # opencode 客户端（读: /file、/file/content；写: /pty base64/touch/mkdir/rm）
  webpack.config.js            # 构建配置
  tsconfig.json
```

## 读写链路

```
读：编辑器/文件树 → DynamicRequest → GET /file、/file/content
写（均经 POST /pty，因 opencode 无直接写端点）：
  保存   onDidSaveTextDocument → printf %s '<base64>' | base64 -d > '/workspace/<path>'
  新建   onDidCreateFiles      → 含扩展名: touch；否则: mkdir -p
  删除   onDidDeleteFiles      → rm -rf '/workspace/<path>'
```

- base64 方案规避 shell 转义：文件内容不以明文进入命令行，任意字符安全落盘。
- **文件/目录判定局限**：`onDidCreateFiles` 回调只给相对路径字符串、不带 file/dir 标识（实测新建文件夹传 `["test2"]`）。当前用「末段是否含扩展名」启发式判断，生产应改用文件系统 stat 精确判断。

## 运行

前置：opencode 后端已启动（见 `../opencode-docker`，默认 `http://127.0.0.1:24096`）。

```bash
npm install
npm run dev        # http://localhost:8888
```

后端地址可通过环境变量覆盖（默认 `http://127.0.0.1:24096`）：

```bash
OPENCODE_BASE_URL=http://127.0.0.1:24096 npm run dev
```

## 已知问题 / 待验证

- **Monaco worker 走阿里云 CDN**：`editor.worker.bundle.js` 从 `gw.alipayobjects.com` 加载，离线/受限网络会报 `importScripts` / `INVALID tab` 错误。不影响读写与语法高亮，但生产需将 worker 资源本地化托管。
- **写回一致性**：IndexedDB 上层与 opencode 落盘内容一致性、并发保存、失败回滚策略待完善（当前失败仅 `console.error`）。
- **文件/目录判定**：新建走「扩展名」启发式，无扩展名文件、带点目录会误判；应改用 stat 精确判断。
- **重命名**：`onDidRename` 类回调未接（重命名 = 删除+新建，行为待验证）。
- **IndexedDB 与容器不同步的场景**：新会话加载时，旧 IndexedDB 缓存中的文件（如上次建的 test2）不会重放写回，导致前端有、容器无的偏差；需设计缓存与后端对账策略。
- **子目录懒加载性能**：大目录按需加载表现待压测。
- 端口 8888（8080 本机被 Docker 占用）。

