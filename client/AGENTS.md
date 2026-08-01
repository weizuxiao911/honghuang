# client（交互平面） AI 协作规则

> 本目录的 AI 工作约束。`README.md` 描述是什么；本文件约束怎么做。

## 单一职责

- 本模块只负责**交互平面**：布局骨架、窗口生命周期、插件宿主、通信总线。
- 不实现任何业务交互逻辑；不内置 Agent 推理；不直接读写文件。
- 任何「能不能在 client 里加一段业务代码」的提问，默认答案：**不能**，放到对应 VSIX（业务能力归 `taichu/extensions/`，不在 `taichu/client/` 内）。

## 技术栈与配置

- 内核：`OpenSumi` / `CodeBlitz`（`@codeblitzjs/ide-core`），纯前端，无 Node.js 运行时。
- 浏览器原生 `fetch` / `EventSource`（SSE）。
- 配置外置：`appConfig` / `builtInExtensions` / `command` 注册均抽成独立 `.json` 文件，路径与命名在实现时确定。

## 与其它模块的契约

- **禁止**跨包直接导入其它模块代码。
- 插件与插件、插件与容器之间只通过**全局 command 命令 ID**联动。
- 与 agent-image 的所有数据通道**必须**经 gateway 网关，不允许直连。
- 业务 VSIX 源码不在 `taichu/client/` 下，统一维护在 `taichu/extensions/{name}/`。

## 一致性义务

任何对本目录的修改必须保持与以下文件不互相矛盾：

- [`../功能设计.md`](../功能设计.md)（产品蓝图）
- [`../架构设计.md`](../架构设计.md)（技术蓝图）
- [`../README.md`](../README.md)（项目总览）
- [`../AGENTS.md`](../AGENTS.md)（项目治理）

修订前先读这四份，修订后核对其余四份。