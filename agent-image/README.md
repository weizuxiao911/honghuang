# agent-image（运行平面）

> Agent 运行平面最小隔离单元。单用户独享 Pod 沙箱，承载全部 Agent 推理、工具调用、业务执行逻辑。

详细职责、边界、技术栈见 [`../设计文档.md`](../设计文档.md) 第四章「agent-image（运行平面）」。

## 当前状态

**最小骨架已就位**。本目录已包含：

- 标准化 Docker 镜像契约（[`Dockerfile`](./Dockerfile)）
- 默认运行时配置（[`opencode.json`](./opencode.json)，业务 Agent 由 gateway 注入）
- 容器启动入口（[`start.sh`](./start.sh)，本地/CI 验证用）
- 镜像构建排除规则（[`.dockerignore`](./.dockerignore)）
- 协议契约文档（[`docs/A2UI契约.md`](./docs/A2UI契约.md)、[`docs/MCP契约.md`](./docs/MCP契约.md)）

**未包含**：业务 Agent、模型凭据、生产部署脚本。生产部署由 [`../gateway/`](../gateway/) 通过 K8s 编排完成。

## 本地验证

```bash
cd agent-image
bash start.sh
# 容器 agent-image-dev 启动，宿主端口 14096 → 容器 4096
curl -s -H Accept:application/json http://127.0.0.1:14096/global/health
```

启动脚本会自动创建 `workspace/` `data/` `config/` 三个运行时挂载点（已在 `.gitignore` 排除，不入库）。

## 边界约束

- **镜像与业务完全解耦**：本镜像不预装任何业务 Agent；业务由 gateway 通过 `opencode.json` / `config` 挂载注入。
- **持久化边界**：所有用户私有数据（工作区、配置、会话、凭证）必须落到 PVC 挂载点；Pod 销毁后保留。
- **不渲染 UI**：A2UI 流式组件结构由 opencode 输出；最终 UI 渲染由 [`../app/`](../app/) 完成。
- **鉴权透传**：用户身份由环境变量注入；**不**硬编码 API Key。

## 与其它模块的接口

- **上游调度**：[`../gateway/`](../gateway/) 通过 K8s API 创建并管理本模块 Pod 生命周期。
- **配置注入**：gateway 按需向本模块写入 `opencode.json` / VSIX 名单 / 用户身份环境变量。
- **业务回流**：遵循 A2UI 协议生成流式 UI 数据，经 gateway 网关 SSE 推回 [`../app/`](../app/) 对话插件渲染。