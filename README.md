# 洪荒（Honghuang）

> 开箱即用的通用 Agent 产品基座。**胶水哲学**为项目核心思想：平台本身不重复造底层基础设施、不固化业务功能，仅作为标准化连接层。

## 这是什么

洪荒是一套把成熟开源组件（OpenSumi / OpenCode / Kubernetes）粘合起来、按多租户 SaaS 标准组织起来的产品基座。目标是：业务方只需**新增插件、调整配置**，即可快速落地可运营的 Agent 产品，不必再从零搭建容器调度、SSE 通道、插件分发、用户隔离等基础设施。

平台分为三个互相解耦的平面：

- **交互平面**：浏览器侧 OpenSumi/CodeBlitz 纯前端容器，业务全部由 VSIX 扩展承载。
- **调度平面**：Spring Cloud Gateway + K8s 编排，按用户/租户隔离沙箱。
- **Agent 运行平面**：标准化 Docker 镜像 + OpenCode 运行时，按需加载业务 Agent 插件。

## 四模块

| 模块 | 路径 | 职责 | 技术栈 |
|------|------|------|--------|
| **紫府（zifu）** | [`zifu/`](./zifu/) | 交互平面底层容器宿主；纯前端标准化交互底座 | OpenSumi/CodeBlitz、纯浏览器 |
| **琅嬛（langhuan）** | [`langhuan/`](./langhuan/) | VSIX 插件资产分发中心；版本管控、灰度、CDN | Spring Boot、MySQL、Redis、OSS、CDN |
| **太虚（taixu）** | [`taixu/`](./taixu/) | 全局调度平面；流量网关 + K8s 运行时编排中枢 | Spring Cloud Gateway、WebFlux、Fabric8、Redis |
| **洞府（dongfu）** | [`dongfu/`](./dongfu/) | Agent 运行平面最小隔离单元；单用户独享 Pod 沙箱 | 标准化 Docker 镜像、OpenCode、MCP、A2UI |

完整产品使用闭环与胶水哲学详述见 [`设计文档.md`](./设计文档.md)。

## 调研产物（参考实现）

本仓库另含两类**前期调研产物**，已沉淀事实，但**不作为正式工程的一部分**：

- **`docs/`**：前期调研文档集，含 opencode API、事件流、OpenSumi/OpenCode 前后端分离、VSIX 开发与分发等实测结论；以及 [`架构设计.md`](./docs/架构设计.md)（早期 AgentNest 命名下的架构讨论，技术结论可复用）。阅读入口：[`docs/README.md`](./docs/README.md)。
- **`.poc/`**：前期可运行验证，含 opencode Docker 化、OpenSumi 容器、自研 VSIX 扩展、VSIX 分发注册中心。阅读入口：[`.poc/README.md`](./.poc/README.md)。

调研产物以**只读参考**对待；正式工程以四模块为准。

## 当前状态

**规划中**。四模块目录已建立工程位并填充 README / AGENTS / .gitignore 占位骨架，尚未包含源码。后续源码迁移与正式实施按各模块目录内的规划推进。

## 文档职责分层

- `README.md`（本文件）：面向人，描述产品定位、四模块结构、调研产物位置。
- `AGENTS.md`：面向 AI，定义跨模块的协作、决策、执行、文档一致性约束。
- `设计文档.md`：产品蓝图（唯一事实源），所有正式工程以此为准。
- 各模块 `README.md` / `AGENTS.md`：模块自身的边界、接口、约束与 AI 工作规则。