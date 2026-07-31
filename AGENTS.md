# AGENTS.md

> 给 AI 看的 Taichu（太初）项目协作规则。

## 项目定位

Taichu（太初）：开箱即用通用 Agent 产品基座。**胶水哲学**为核心思想——平台不重复造底层基础设施、不固化业务功能，仅作为标准化连接层。

完整产品蓝图见 [`./设计文档.md`](./设计文档.md)（**唯一事实源**）。

## 铁律

1. **设计文档为唯一事实源**。任何与设计文档不一致的代码、配置、注释均视为错误。
2. **单一职责**。模块只做一件事，不跨模块堆逻辑。
3. **跨模块只通过约定接口**。禁止模块间直接导入代码。
4. **配置外置**。OpenSumi / K8s / VSIX / opencode.json 等配置抽成独立文件，不散落代码里。
5. **TS / ESM 优先**（前端与 Node 侧脚本）。Java 工程遵循 Spring Boot / Cloud 既有约定。
6. **过程产物统一 `.cache/`**。临时截图、playwright 快照、采样日志、probe 输出均放 `taichu/.cache/`。
7. **敏感信息不入库**。凭证、API Key、Token 不入库；运行时数据目录已 gitignore。
8. **中文优先**。文档、接口说明、用户可见文案以中文为主。
9. **命名规范**。本仓库统一命名为 Taichu（太初；一级目录 `taichu/`）；模块一级目录固定为 `app/` / `registry/` / `gateway/` / `agent-image/`。`紫府/琅嬛/太虚/洞府` 与 `zifu/langhuan/taixu/dongfu` 等旧命名不再出现于正式文档、配置、代码注释与提交信息。
10. **全局一致性**。设计文档 / README / AGENTS / 四模块 README&AGENTS 任一改动后，核对其余部分同步。

## 四模块边界速查

| 模块 | 做 | 不做 |
|------|----|------|
| **app** | 布局骨架、窗口生命周期、插件宿主、通信总线、SSE 接收 | 业务逻辑、Agent 推理、直接文件读写 |
| **registry** | VSIX 元数据、版本、灰度、CDN 分发、RBAC 裁剪 | Agent 任务执行、K8s 调度、运行时业务 |
| **gateway** | 网关转发、K8s Pod 生命周期、Redis 双索引、TTL 回收、SSE 反代 | 前端渲染、A2UI 协议解析、插件资产存储 |
| **agent-image** | Agent 推理、工具调用、MCP 反向调用、A2UI 输出 | 调度决策、插件分发、UI 渲染 |

## 参考资料

- `docs/`、`docs/README.md`：保留前期对底层开源组件的实测文档集。**只读参考**，不修改、不删除。
- `docs/` 的实测结论由 AI 在会话中自行消化，不必写进正式工程文档。
- 正式工程文档（README/AGENTS/设计文档/子模块 README/AGENTS）**不得**再以任何路径、链接、注释、命令示例形式引用 `.poc/` 或 `poc-*` 等运行产物。`.poc/` 整目录已从入库中移除，仅作本地保留。

## K8s 本地测试规则（docker-desktop）

适用于本仓库所有模块在 K8s 上的本地验证。

### 端口与访问路径

- docker-desktop K8s 是**单节点 cluster**，ingress-nginx-controller 通过 **LoadBalancer (EXTERNAL-IP=localhost)** 直接暴露到宿主机 `localhost:80`（HTTP）和 `localhost:443`（HTTPS）。
- **不需要** kubectl port-forward，**不需要** NodePort 端口（31071/32107 实际不通）。
- 推荐路径：直接 `curl -H "Host: <your-host>" http://localhost/<path>`。
- 备选路径（仅健康检查，跳过 Ingress）：`kubectl port-forward -n <ns> svc/<svc-name> 8080:<svc-port>` 或 `kubectl exec`。

### Host 约定

- Ingress 资源必须显式声明 `host`（如 `gateway.taichu.localhost` / `*.runtime.taichu.localhost`）。
- docker-desktop 上 `*.localhost` 子域名会自动解析到 127.0.0.1，**不**需要修改 `/etc/hosts`。
- curl 验证时必须带 `-H "Host: <host>"`，否则命中 ingress-nginx-controller 默认后端（实测返回 404 或其它应用占位）。

### Ingress 注解（按需）

- SSE 长连接：`nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`、`proxy-send-timeout: "3600"`。
- 大报文：`nginx.ingress.kubernetes.io/proxy-body-size: "0"`（不限制，opencode `/doc` 478KB+）。

### 验证顺序

1. Pod Ready（`kubectl wait --for=condition=ready pod -l app=<x> -n <ns>`）。
2. Service Endpoint 已绑定 Pod IP（`kubectl get ep -n <ns>`）。
3. Ingress 资源已创建（`kubectl get ingress -n <ns>`）。
4. curl 验证：`curl -H "Host: <host>" http://localhost/<path>`。
5. 业务功能（POST /session、PTY 写文件等）。

## 任务执行

按根目录 [`../AGENTS.md`](../AGENTS.md) 的「核心决策规则」与「标准工作流程」执行。本项目的特殊约束已在「铁律」「四模块边界速查」「参考资料」中说明。

## 文档职责分层

- `README.md`：人看，产品定位与四模块导览。
- `AGENTS.md`（本文件）：AI 看，项目协作与一致性约束。
- `设计文档.md`：产品蓝图（唯一事实源）。
- 各模块 `README.md` / `AGENTS.md`：模块自身的人/AI 文档。
- `docs/README.md`：调研文档集导读。

## 一致性核验

任何对正式工程的修改完成后，核对：

1. 与 `设计文档.md` 对应章节一致。
2. 与本文件「铁律」「四模块边界速查」一致。
3. 与 `README.md` 模块结构表一致。
4. 与涉及到的其它模块的 `README.md` / `AGENTS.md` 一致。
5. 参考资料（`docs/`）未被误改；正式文档中不再出现旧命名（`zifu/langhuan/taixu/dongfu` 与中文别名）或 `.poc/` 路径。

## AI 协作补充规则（继承根 AGENTS.md 并项目级细化）

按根目录 [`../AGENTS.md`](../AGENTS.md) 的「判断标准：明显 vs 可能争议」执行。本项目落地：

- **直接做**：
  - 修复 taichu 模块的拼写/格式/注释错误
  - 调整 `application.yml`、K8s 清单中的非语义参数值（副本数、timeout、CPU/Mem）
  - 收敛旧命名（铁律 9）至 `app/` / `registry/` / `gateway/` / `agent-image/`
  - 模块 README / AGENTS / 设计文档的结构性补全

- **必须用 `question` 确认**：
  - 改 `设计文档.md` 的任何产品蓝图字段（状态机、协议、拓扑）
  - 改模块边界（违反铁律 2「单一职责」、铁律 3「跨模块只通过约定接口」）
  - 引入新依赖、新 tool、新 CI 步骤（如新增 Helm chart、ArgoCD、Sidecar）
  - 删除/迁移/重建 K8s 资源、覆盖远端 registry、强制 push
  - RuntimeService 状态机、SSE 协议契约、agent-image 镜像 tag 等核心运行时契约变更
  - 公开 HTTP/SDK API 路径或参数变更（chat-window / session-manager / opencode 调用 gateway 的契约）
  - 与本文件「铁律」冲突或扩展