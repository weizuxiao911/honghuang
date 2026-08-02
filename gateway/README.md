# gateway（调度平面）

> 全局调度平面：流量网关 + K8s 运行时编排中枢。承接交互平面请求，标准化管理用户专属 Agent 隔离沙箱。

详细职责、边界、技术栈见 [`../设计文档.md`](../设计文档.md) 第三章「gateway（调度平面）」。

## 当前状态

**最小骨架已就位**。本目录已包含：

- Spring Boot 3.2.5 + Java 21 Maven 工程
- Spring Cloud Gateway 2023.0.3（反应式网关）
- Spring Cloud Kubernetes Fabric8（K8s 客户端）
- Spring Data Redis Reactive（双索引 + TTL）
- 核心 Java 类（Controller / Filter / Service / Repository / Model / Config）
- K8s 部署清单（deploy/k8s/deployment.yaml）
- Dockerfile

## 核心功能（按设计文档第三章）

- **流量网关模块**：收敛公网流量，区分主域名平台接口与子域名运行实例路由；统一鉴权、SSE 长连接透传、限流、熔断降级、全链路日志。
- **K8s 编排调度模块**：预置 Deployment / Service / PVC / HPA 资源模板，按需创建用户独占 Pod；Redis 双索引（userId ⇄ runtimeId）管理运行时状态；TTL 自动回收。
- **双通道寻址规则**：同源请求靠 `x-runtime-id` Header 定位实例；跨端跳转靠子域名 Host 匹配路由。
- **反向代理**：将前端 A2UI 请求经 SSE 转发至对应agent-image沙箱。

## 边界约束

- **不**渲染前端界面，**不**解析 A2UI 业务协议，**不**承载 Agent 业务执行逻辑。
- **不**硬编码服务凭据；鉴权统一由网关完成。
- **不**直接代理 registry 下载接口。

## 路由规则（设计文档第三章）

| 路由类型 | 匹配规则 | 目标端口 | 说明 |
|---------|---------|---------|------|
| **Master API** | `localhost/runtime/**` | 8080 | Agent 生命周期管理 |
| **Agent API** | `localhost/agent/**` | 4096 | OpenCode 原生 API（去掉 /agent 前缀） |
| **子域名 WebUI** | `{runtimeId}.localhost/**` | 4096 | VS Code Web 界面 |
| **健康检查** | `localhost/health` | 8080 | K8s 探针 |

## 沙箱生命周期与回收（设计文档第四章流程 6）

**生命周期**：每个用户独占一个沙箱 Pod（Deployment + Service），Redis 双索引 `{prefix}:user:{userId}` / `{prefix}:runtime:{runtimeId}` 带 TTL 存活（默认 `ttl: 600` 秒 = 10 分钟）。

**续约**：有操作才续约，两条路径，统一规则 = **剩余 TTL ≤ min(`renew-threshold-seconds`, `renew-threshold-max-seconds`，默认 180s = 3 分钟) 才续满全量 ttl**（Lua 原子判断+续约，活跃期剩余时间维持在 3~10 分钟）：

- 客户端 `POST /runtime` 命中可复用索引时检查续约（`RuntimeService#reuseExisting`）；
- **数据平面流量续约**：所有走 runtime 的请求（子域名 `{runtimeId}.runtime.taichu.localhost/**` 与 `/agent/*`，含 sandbox 内 SSE 流）命中快照时检查续约（`RuntimeRoutingFilter#renewIfNeeded`），按 `renew-throttle-seconds`（默认 5s）节流防频繁 PTTL/EXPIRE，续约失败不影响转发。**节流状态存 Redis**（Lua 原子处理，多副本共享，无内存状态）。

> 无独立 SSE 续约子流：数据平面流量续约已覆盖订阅期间的租约保活。

**回收（双链路，缺一不可）**：

1. **主链路：Redis keyspace 过期通知**。TTL 到期 → Redis PUBLISH `__keyevent@0__:expired` → `RedisExpiryListener` 实时回收。
   **前提：Redis 必须开启 `--notify-keyspace-events Ex`**（见 `deploy/k8s/redis.yaml`），未开启则主链路静默失效，只剩兜底。
2. **兜底：孤儿巡检**。`RuntimeSweeper` 每 `sweep-interval-seconds`（默认 300s）对账一次：Fabric8 Informer 缓存（启动一次 list + watch 增量，**对 K8s API server 零轮询**）中创建超过宽限期 `sweep-grace-seconds`（默认 600s）且 Redis 无索引的 Deployment，判定为孤儿并回收。主链路漏回收时兜底兜住。

**回收动作**：删除该 runtime 的 Deployment + Service，并广播 `RECYCLED` SSE 事件；**不删共享 workspace PVC**（subPath 按用户隔离，数据留存，下次秒级重建）。

**配置项**（`gateway.runtime` 下，集群 ConfigMap 与本地 `application.yml` 需同步维护）：

| 配置 | 默认 | 说明 |
|------|------|------|
| `ttl` | 600 | 运行时空闲 TTL（秒） |
| `renew-throttle-seconds` | 5 | 数据平面流量续约节流，须小于 ttl |
| `renew-threshold-seconds` | 180 | 续约阈值：剩余 TTL ≤ 该值才续满 |
| `renew-threshold-max-seconds` | 180 | 续约阈值硬上限（默认 3 分钟） |
| `reclaim.sweep-enabled` | true | 兜底巡检开关 |
| `reclaim.sweep-interval-seconds` | 300 | 兜底巡检间隔 |
| `reclaim.sweep-initial-delay-seconds` | 30 | 启动后首轮巡检延迟 |
| `reclaim.sweep-grace-seconds` | 600 | 孤儿宽限期（默认 = ttl） |

**维护要点**：改 Redis 参数或 TTL 相关配置时，集群 ConfigMap `gateway-config` 与 `deploy/k8s/redis.yaml`、本地 `application.yml` 三处必须保持一致；改回收链路需先读设计文档第四章流程 6。

## 快速启动

```bash
# 1. 编译
mvn clean compile

# 2. 打包
mvn clean package -DskipTests

# 3. 本地启动（需 K8s 环境 + Redis）
mvn spring-boot:run

# 4. 构建镜像
docker build -t gateway:dev .

# 5. 部署到 K8s
kubectl apply -f deploy/k8s/deployment.yaml
```

## 与其它模块的接口

- **上游调用方**：[`../app/`](../app/) 域的浏览器容器所有 HTTP/SSE 请求。
- **下游运行时**：本模块通过 K8s API 创建并管理 [`../agent-image/`](../agent-image/) Pod。
- **插件来源**：本模块按需向 [`../registry/`](../registry/) 拉取可下发的 VSIX 名单，写入 agent-image 容器配置。

## 参考资料

- 概念参考：`/Users/weizuxiao/Documents/studio/03-开源资产/browser-runtime/02-中期-opensumi-in-browser/agent-gateway`
- 总体架构权衡见 [`../docs/架构设计.md`](../docs/架构设计.md)