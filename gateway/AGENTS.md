# gateway（调度平面） AI 协作规则

> 本目录的 AI 工作约束。`README.md` 描述是什么；本文件约束怎么做。

## 单一职责

- 本模块只做**流量调度 + 资源编排**：网关转发、K8s Pod 生命周期、Redis 状态索引。
- **不**实现 Agent 业务逻辑，**不**实现 VSIX 业务逻辑，**不**存储插件资产。

## 技术栈

- **Java 21** + **Spring Boot 3.2.5** + **Spring Cloud 2023.0.3**
- **Spring Cloud Gateway**（反应式网关，支撑 SSE 长连接透传）
- **Spring Cloud Kubernetes Fabric8**（K8s 资源操作）
- **Spring Data Redis Reactive**（runtimeId ⇄ userId 双向索引、TTL 自动过期）
- **Lombok**（简化代码）

## 与其它模块的契约

- **对 app（上游）**：暴露平台域接口与子域名运行实例路由入口；Header 中透明透传用户/租户身份。
- **对 agent-image（下游）**：通过 K8s API 创建并销毁 Pod；按需注入 opencode.json / VSIX 名单 / 环境变量；SSE 反向代理至前端。
- **对 registry（旁路）**：按需拉取可下发的 VSIX 名单，用于注入 agent-image 配置。**不**直接代理 registry 的下载接口。

## 关键约束

- **双通道寻址**：同源靠 `x-runtime-id` Header；跨端靠子域名 Host。两条链路不得混用。
- **TTL 与回收**：Redis 索引必须带 TTL；TTL 过期后必须自动触发 Pod 销毁与 PVC 清理巡检。
- **SSE 透传**：必须使用反应式栈（WebFlux），禁止在网关内做阻塞式缓冲；流式响应必须端到端保持。
- **安全**：不硬编码服务凭据；鉴权统一由网关完成；下游 Pod 启用 NetworkPolicy 限制出网。
- **反应式**：禁止 `Mono.block()`、`Thread.sleep()` 等阻塞 API。
- **领域纯净**：`service/`、`model/` 层不得引入任何 Spring 依赖（按 DDD 分层）。
- **SPI 设计**：扩展点必须定义在领域层（`repository/`、`service/` 接口），基础设施层实现。

## 一致性义务

任何对本目录的修改必须保持与以下文件不互相矛盾：

- [`../设计文档.md`](../设计文档.md)（产品蓝图，本模块对应第三章）
- [`../README.md`](../README.md)（项目总览）
- [`../AGENTS.md`](../AGENTS.md)（项目治理）

修订前先读这三份，修订后核对其余三份。