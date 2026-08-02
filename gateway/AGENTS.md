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

## 沙箱生命周期维护规则（设计文档第四章流程 6）

运行时沙箱默认 TTL 存活（`gateway.runtime.ttl`，部署默认 600s = 10 分钟），**有操作才续约**，统一规则 = **剩余 TTL ≤ min(`renew-threshold-seconds`, `renew-threshold-max-seconds`) 才续满全量 ttl**（`RuntimeRepository#renewIfLow`，Lua 原子判断+续约；`renew-threshold-max-seconds` 默认 180s 为阈值硬上限，见 `PlatformProperties#effectiveRenewThresholdSeconds`，禁止在代码里硬编码阈值数值）：

1. `POST /runtime` 命中可复用索引检查续约（`RuntimeService#reuseExisting`）；
2. **数据平面流量续约**：所有走 runtime 的请求（子域名 + `/agent/*`，含 sandbox 内 SSE 流）在 `RuntimeRoutingFilter#renewIfNeeded` 检查续约，按 `renew-throttle-seconds`（默认 5s）节流防频繁 PTTL/EXPIRE。

**无独立 SSE 续约子流**（`SseLeaseRenewer` 已移除）：数据平面流量续约已覆盖订阅期间租约保活。续约语义变更（阈值、目标 ttl、节流）时两条路径同步改，并核对 README「沙箱生命周期与回收」。

回收走**双链路**，缺一不可：

1. **主链路：Redis keyspace 过期通知**（`RedisExpiryListener` 订阅 `__keyevent@*__:expired`）
   - **前提：Redis 必须开启 `--notify-keyspace-events Ex`**（`deploy/k8s/redis.yaml`）。改 Redis 部署清单时不得移除该参数，否则主链路静默失效、孤儿只能靠兜底回收。
2. **兜底：孤儿巡检**（`RuntimeSweeper`，`@Scheduled` + Fabric8 Informer 缓存）
   - **禁止巡检周期性调用 K8s list API**：Deployment 列表必须走 informer 本地缓存（启动一次 list + watch 增量，断线自动重连），巡检只读 store、对 K8s API server 零轮询。
   - 孤儿判定：Deployment 创建超过宽限期 `reclaim.sweep-grace-seconds` 且 Redis 无 `{prefix}:runtime:{runtimeId}` 索引。Redis 对账必须一次 `multiGet` 批量完成，不逐个 GET。
   - 安全：Redis 对账异常时跳过本轮，不得因 Redis 故障误删活沙箱。

维护规则：

- 回收只删 Deployment + Service，**不删共享 workspace PVC**（subPath 按用户隔离，数据留存）。
- 回收动作必须走 `RuntimeRecycler`（幂等：404 视为成功；多副本同时收到过期事件无副作用）。
- `gateway.runtime.reclaim.*` 配置（`sweep-enabled` / `sweep-interval-seconds` / `sweep-initial-delay-seconds` / `sweep-grace-seconds`）修改后，集群 ConfigMap `gateway-config` 与本地 `application.yml` 必须同步；`@Scheduled` 的 `${...}` placeholder 一律带默认值，防 ConfigMap 未同步时启动失败。
- 三处 TTL 相关配置保持一致：集群 ConfigMap、本地 `application.yml`、`deploy/k8s/redis.yaml`。
- 任何回收链路改动（状态机、TTL 语义、keyspace 协议、巡检策略）需先读设计文档第四章流程 6，并同步本 README「沙箱生命周期与回收」章节。

## 一致性义务

任何对本目录的修改必须保持与以下文件不互相矛盾：

- [`../设计文档.md`](../设计文档.md)（产品蓝图，本模块对应第三章）
- [`../README.md`](../README.md)（项目总览）
- [`../AGENTS.md`](../AGENTS.md)（项目治理）

修订前先读这三份，修订后核对其余三份。