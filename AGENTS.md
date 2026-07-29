# AGENTS.md

> 给 AI 看的洪荒（Honghuang）项目协作规则。

## 项目定位

洪荒：开箱即用通用 Agent 产品基座。**胶水哲学**为核心思想——平台不重复造底层基础设施、不固化业务功能，仅作为标准化连接层。

完整产品蓝图见 [`./设计文档.md`](./设计文档.md)（**唯一事实源**）。

## 铁律

1. **设计文档为唯一事实源**。任何与设计文档不一致的代码、配置、注释均视为错误。
2. **单一职责**。模块只做一件事，不跨模块堆逻辑。
3. **跨模块只通过约定接口**。禁止模块间直接导入代码。
4. **配置外置**。OpenSumi / K8s / VSIX / opencode.json 等配置抽成独立文件，不散落代码里。
5. **TS / ESM 优先**（前端与 Node 侧脚本）。Java 工程遵循 Spring Boot / Cloud 既有约定。
6. **过程产物统一 `.cache/`**。临时截图、playwright 快照、采样日志、probe 输出均放 `honghuang/.cache/`。
7. **敏感信息不入库**。凭证、API Key、Token 不入库；运行时数据目录已 gitignore。
8. **中文优先**。文档、接口说明、用户可见文案以中文为主。
9. **命名规范**。模块一级目录固定为 `zifu/` / `langhuan/` / `taixu/` / `dongfu/`。
10. **全局一致性**。设计文档 / README / AGENTS / 四模块 README&AGENTS 任一改动后，核对其余部分同步。

## 四模块边界速查

| 模块 | 做 | 不做 |
|------|----|------|
| **zifu**（紫府） | 布局骨架、窗口生命周期、插件宿主、通信总线、SSE 接收 | 业务逻辑、Agent 推理、直接文件读写 |
| **langhuan**（琅嬛） | VSIX 元数据、版本、灰度、CDN 分发、RBAC 裁剪 | Agent 任务执行、K8s 调度、运行时业务 |
| **taixu**（太虚） | 网关转发、K8s Pod 生命周期、Redis 双索引、TTL 回收、SSE 反代 | 前端渲染、A2UI 协议解析、插件资产存储 |
| **dongfu**（洞府） | Agent 推理、工具调用、MCP 反向调用、A2UI 输出 | 调度决策、插件分发、UI 渲染 |

## 调研产物处理

- `docs/`、`docs/README.md`：前期调研文档集。**只读参考**，不修改、不删除。
- `.poc/`、`.poc/README.md`：前期可运行验证。**只读参考**，不修改、不删除。
- 调研结论由 AI 在会话中自行消化，不必写进正式工程文档。

## K8s 本地测试规则（docker-desktop）

适用于本仓库所有模块在 K8s 上的本地验证。

### 端口与访问路径

- docker-desktop K8s 上 ingress-nginx-controller 通过 NodePort 暴露（默认 31071/32107），**不**是直接 `localhost:80`/`443`。
- 推荐路径：`kubectl port-forward -n ingress svc/ingress-nginx-controller 8080:80` + `Host: <your-host>` Header。
- 备选路径（仅健康检查）：`kubectl port-forward -n <ns> svc/<svc-name> 8080:<svc-port>` 直接绕过 Ingress。
- **不要**改 ingress-nginx-controller Service 的 NodePort（破坏其它应用端口约定）；端口冲突时改用 port-forward。

### Host 约定

- Ingress 资源必须显式声明 `host`（如 `df-dev.localhost`）。
- docker-desktop 上 `*.localhost` 子域名会自动解析到 127.0.0.1，**不**需要修改 `/etc/hosts`。
- curl 验证时必须带 `-H "Host: <host>"`，否则命中 ingress-nginx-controller 默认后端（实测可能被其它应用占用）。

### Ingress 注解（按需）

- SSE 长连接：`nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"`、`proxy-send-timeout: "3600"`。
- 大报文：`nginx.ingress.kubernetes.io/proxy-body-size: "0"`（不限制，opencode `/doc` 478KB+）。

### 验证顺序

1. Pod Ready（`kubectl wait --for=condition=ready pod -l app=<x> -n <ns>`）。
2. Service Endpoint 已绑定 Pod IP（`kubectl get ep -n <ns>`）。
3. Ingress 资源已创建（`kubectl get ingress -n <ns>`）。
4. kubectl port-forward ingress-nginx-controller 到本机端口（`kubectl port-forward -n ingress svc/ingress-nginx-controller 8080:80`）。
5. curl 验证：`curl -H "Host: <host>" http://localhost:8080/<path>`。
6. 业务功能（POST /session、PTY 写文件等）。

## 任务执行

按根目录 [`../AGENTS.md`](../AGENTS.md) 的「核心决策规则」与「标准工作流程」执行。本项目的特殊约束已在「铁律」「四模块边界速查」「调研产物处理」中说明。

## 文档职责分层

- `README.md`：人看，产品定位与四模块导览。
- `AGENTS.md`（本文件）：AI 看，项目协作与一致性约束。
- `设计文档.md`：产品蓝图（唯一事实源）。
- 各模块 `README.md` / `AGENTS.md`：模块自身的人/AI 文档。
- `docs/README.md`：调研文档集导读。
- `.poc/README.md`：调研验证导读。

## 一致性核验

任何对正式工程的修改完成后，核对：

1. 与 `设计文档.md` 对应章节一致。
2. 与本文件「铁律」「四模块边界速查」一致。
3. 与 `README.md` 模块结构表一致。
4. 与涉及到的其它模块的 `README.md` / `AGENTS.md` 一致。
5. 调研产物（`docs/`、`.poc/`）未被误改。