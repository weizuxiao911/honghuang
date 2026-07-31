# MCP 契约（agent-image 侧）

> MCP（Model Context Protocol）：Agent 与外部工具/服务标准化通信的协议。

## agent-image 责任

- 内置 MCP 协议客户端（由 opencode 运行时承载）。
- 通过 MCP 反向调用外部业务服务（如 LangHuan API、第三方 SaaS、模型网关）。
- 用户身份由环境变量注入（`USER_ID`、`TENANT_ID` 等，由 gateway 在 Pod 创建时设置），复用统一鉴权链路。
- MCP 服务端配置由 `opencode.json` 的 `mcp` 字段声明，**不**硬编码服务地址。

## 鉴权链路

- **不**在 agent-image 内维护登录态，**不**硬编码 API Key。
- MCP 服务调用的用户身份 Header 由 opencode 根据环境变量自动注入。
- 上游 gateway 网关按租户对 MCP 调用做限流、熔断与审计。

## 不在 agent-image 责任范围

- MCP 服务的发现与注册：由 LangHuan（[`../../registry/`](../../registry/)）维护；agent-image 仅消费。
- MCP 服务端实现：由业务方提供。
- 模型路由与配额管理：由独立模型网关承担（不在当前四模块边界内）。

## 协议规范参考

- MCP 规范：<https://modelcontextprotocol.io/>
- opencode 对 MCP 的支持边界：见 [`../../docs/opencode-server-api调研.md`](../../docs/opencode-server-api调研.md)。

## 唯一事实源

[`../设计文档.md`](../设计文档.md) 第四章「agent-image（agent-image）」> 核心功能 4 与后端运行规范。