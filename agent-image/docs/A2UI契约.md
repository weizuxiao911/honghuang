# A2UI 契约（agent-image 侧）

> A2UI（Agent-to-UI）：声明式流式 UI 协议。Agent 侧生成组件结构，前端本地管控表单双向绑定。

## agent-image 责任

- Agent 输出符合 A2UI 规范的组件树（JSON 流式）。
- 通过 SSE 通道（opencode v2 `/api/session/:id/event`，详见 [`../../docs/opencode-事件流调研.md`](../../docs/opencode-事件流调研.md)）将组件结构增量推送给上游。
- **不**做最终 UI 渲染，**不**解析 A2UI 业务含义，**不**维护组件状态。

## 不在 agent-image 责任范围

- A2UI 协议解析、组件实例化、表单双向绑定：均由 app 对话类 VSIX 完成。
- A2UI 协议版本协商：由 gateway 网关负责，agent-image 仅透传。

## 协议版本

A2UI 能力边界以 opencode 实际输出为准。当前已知能力见 [`../../docs/opencode-server-api调研.md`](../../docs/opencode-server-api调研.md)。具体协议规范的演进随 opencode 上游版本同步。

## 唯一事实源

[`../设计文档.md`](../设计文档.md) 第四章「agent-image（agent-image）」> 后端运行规范 > A2UI 协议。