# agent-image（运行平面） AI 协作规则

> 本目录的 AI 工作约束。`README.md` 描述是什么；本文件约束怎么做。

## 单一职责

- 本模块是**Agent 业务执行边界**：所有 Agent 推理、工具调用、业务逻辑都在本模块的 Pod 内完成。
- **不**做调度决策（那是 gateway）；**不**做插件分发（那是 registry）；**不**做交互渲染（那是 app）。

## 技术栈

- 标准化 Docker 镜像（基础镜像契约待定）
- OpenCode 运行时（headless serve）
- 后端 Plugin 加载框架
- MCP 协议（外部业务服务反向调用）
- A2UI 协议（流式 UI 输出）

## 与其它模块的契约

- **对 gateway（上游）**：暴露 headless HTTP + SSE；接受环境变量注入用户身份；接受挂载 PVC 持久工作区。
- **对 app（下游消费者）**：通过 gateway 反向代理输出 A2UI 流式 UI；不直连 app。
- **对 registry（旁路）**：插件源地址由 gateway 注入；本模块按 `opencode.json` 加载，**不**主动调用 registry。

## 关键约束

- **镜像与业务解耦**：基础镜像不绑定任何业务 Agent；业务全部通过 `opencode.json` 动态拉取。
- **持久化边界**：所有用户私有数据（工作区、配置、会话）必须落到 PVC 挂载点；Pod 销毁后保留。
- **A2UI 协议**：Agent 侧生成组件结构，**不**在 agent-image 内做最终 UI 渲染；前端本地管控表单双向绑定。
- **MCP 反向调用**：外部业务服务调用必须走 MCP 协议；用户身份由环境变量注入，复用统一鉴权链路。

## 参考资料

- API 能力边界实测见 [`../docs/opencode-server-api调研.md`](../docs/opencode-server-api调研.md)。
- 事件流（v1 / v2）实测对比见 [`../docs/opencode-事件流调研.md`](../docs/opencode-事件流调研.md)。
- 总体架构权衡见 [`../docs/架构设计.md`](../docs/架构设计.md)。

## 一致性义务

任何对本目录的修改必须保持与以下文件不互相矛盾：

- [`../设计文档.md`](../设计文档.md)（产品蓝图，本模块对应第四章）
- [`../README.md`](../README.md)（项目总览）
- [`../AGENTS.md`](../AGENTS.md)（项目治理）

修订前先读这三份，修订后核对其余三份。