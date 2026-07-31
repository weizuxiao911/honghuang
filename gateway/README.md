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