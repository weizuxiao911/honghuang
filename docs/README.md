# 调研文档集

本目录为**前期调研文档集**，沉淀本项目立项前对底层开源组件的能力边界、技术选型、关键权衡的实测结论。

**正式工程以根目录 [`../设计文档.md`](../设计文档.md)（产品蓝图）为唯一事实源**，本目录内容仅作只读参考，不作为正式工程的一部分。

## 阅读顺序建议

1. [`../设计文档.md`](../设计文档.md)：先读产品蓝图，建立四模块（app / registry / gateway / agent-image）与胶水哲学的整体认知。
2. [`架构设计.md`](./架构设计.md)：早期 AgentNest 命名下的总体架构讨论、K8s 调度设计、关键技术权衡；技术结论可复用，命名差异忽略。
3. 各专题调研（按需查阅）：
   - [`opencode-server-api调研.md`](./opencode-server-api调研.md)：opencode v1.18.8 真实 OpenAPI spec 188 端点实测（四大交互闭环端到端跑通）。
   - [`opencode-事件流调研.md`](./opencode-事件流调研.md)：v1 / global / v2 三套 SSE 端点对比，生产建议走 v2。
   - [`opensumi-opencode前后端分离调研.md`](./opensumi-opencode前后端分离调研.md)：SDK / CodeBlitz / vsix 三方案对比与决策。
   - [`vsix扩展开发标准调研.md`](./vsix扩展开发标准调研.md)：vsix 开发三入口、`sumiContributes`、`browserViews`、打包要点。
   - [`vsix扩展分发管理调研.md`](./vsix扩展分发管理调研.md)：vsix metadata、`kt-ext`、运行时集成、三层分发架构。

## 命名说明

部分调研文档写作时项目工作名为 **AgentNest**，对应正式工程名为 **洪荒（Honghuang）**。两类命名在概念层指代同一项目，迁移到正式工程时按本目录的最终结论与四模块命名（app / registry / gateway / agent-image）执行。