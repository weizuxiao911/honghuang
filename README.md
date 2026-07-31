# Taichu（太初）

> 开箱即用的通用 Agent 产品基座。**胶水哲学**为项目核心思想：平台本身不重复造底层基础设施、不固化业务功能，仅作为标准化连接层。

## 这是什么

Taichu（太初）是一套把成熟开源组件（OpenSumi / OpenCode / Kubernetes）粘合起来、按多租户 SaaS 标准组织起来的产品基座。目标是：业务方只需**新增插件、调整配置**，即可快速落地可运营的 Agent 产品，不必再从零搭建容器调度、SSE 通道、插件分发、用户隔离等基础设施。

平台分为三个互相解耦的平面：

- **交互平面**：浏览器侧 OpenSumi/CodeBlitz 纯前端容器，业务全部由 VSIX 扩展承载。
- **调度平面**：Spring Cloud Gateway + K8s 编排，按用户/租户隔离沙箱。
- **Agent 运行平面**：标准化 Docker 镜像 + OpenCode 运行时，按需加载业务 Agent 插件。

## 四模块

| 模块 | 路径 | 职责 | 技术栈 |
|------|------|------|--------|
| **app** | [`app/`](./app/) | 交互平面底层容器宿主；纯前端标准化交互底座 | OpenSumi/CodeBlitz、纯浏览器 |
| **registry** | [`registry/`](./registry/) | VSIX 插件资产分发中心；版本管控、灰度、CDN | Spring Boot、MySQL、Redis、OSS、CDN |
| **gateway** | [`gateway/`](./gateway/) | 全局调度平面；流量网关 + K8s 运行时编排中枢 | Spring Cloud Gateway、WebFlux、Fabric8、Redis |
| **agent-image** | [`agent-image/`](./agent-image/) | Agent 运行平面最小隔离单元；单用户独享 Pod 沙箱 | 标准化 Docker 镜像、OpenCode、MCP、A2UI |

完整产品使用闭环与胶水哲学详述见 [`设计文档.md`](./设计文档.md)。

## 参考资料

`docs/` 目录保留前期对底层开源组件（OpenSumi / OpenCode / Kubernetes）能力边界、技术选型、关键权衡的实测结论文档集。阅读入口：[`docs/README.md`](./docs/README.md)。

`docs/` 仅作只读参考资料，不作为正式工程的实现入口。

## 当前状态

四模块均已就位并包含 README / AGENTS / 部署清单；源码与镜像可按各模块目录内的说明构建、部署与验证。

## 文档职责分层

- `README.md`（本文件）：面向人，描述产品定位、四模块结构、参考资料位置。
- `AGENTS.md`：面向 AI，定义跨模块的协作、决策、执行、文档一致性约束。
- `设计文档.md`：产品蓝图（唯一事实源），所有正式工程以此为准。
- 各模块 `README.md` / `AGENTS.md`：模块自身的边界、接口、约束与 AI 工作规则。