# opencode server API 调研

> 状态：**已完成实测验证（不是纸面调研）** · 关联文档：《架构设计.md》§5.1、§6
> 方法：本地安装 opencode **v1.18.8**，`opencode serve` 实起服务，抓取真实 OpenAPI spec 并做端到端调用验证。
> 环境：macOS；模型经 `volcengine-agent-plan/ark-code-latest` 实测（anthropic 凭证在本环境 403，不影响 API 结论）。
> 原则：**以实测事实为准，不臆断**。下文每条结论均标注验证方式。

---

## 1. 结论摘要（均经实测）

- **API 开放度充分**，架构文档 §5.1「头号风险」证实解除。四大交互闭环全部实测跑通。
- 本地版实际暴露 **188 个端点**，远多于官网文档所列（官网文档明显滞后）。
- **读文件直连即可**；**写文件有两条已验证可落盘的通道**（Agent write tool、PTY 终端），另有一条未跑通的边缘方案（`/vcs/apply`）。详见 §4。
- 采用标准 **OpenAPI 3.1**，spec 由服务端 `/doc` 实时输出，可直接生成 SDK。

---

## 2. 运行与接入基础（实测）

| 项 | 事实 | 验证 |
|----|------|------|
| 版本 | opencode 1.18.8 | `opencode --version` |
| 启动 | `opencode serve --port <n> [--cors <origin>]` | 实起成功，监听 `127.0.0.1` |
| 默认端口 | 4096 | 文档 + 实测 |
| CORS | 默认全放行（不传 `--cors` 即反射任意 `Origin`，预检 204 + `Access-Control-Allow-Origin` 回显请求源）；`--cors <origin>` 可多次传入以显式限定 | 实测：未传 `--cors` 的 `oc-poc` 容器对任意 Origin 放行；另测 `--cors http://localhost:5173` 启动成功 |
| 鉴权 | `OPENCODE_SERVER_PASSWORD` 开 Basic Auth；未设置时启动会打印 `server is unsecured` 警告 | 实测警告可见 |
| Spec | `GET /doc` 返回 **OpenAPI 3.1** JSON（须带 `Accept: application/json`，否则回退返回 Web UI 的 HTML） | 实测抓到 478KB spec |
| 工作区根 | 由启动时 cwd 决定（`/path` 的 `worktree`/`directory`）；在非 git 目录下 `worktree` 会退化为 `/`，导致文件路径解析异常 | 实测：git 项目根下路径解析正常，裸目录下异常 |

> 关键坑（实测）：`/doc`、`/session/:id/event` 等端点若不带正确 `Accept` 头，会返回 Web 控制台的 HTML 而非 JSON/SSE。集成时必须显式设 `Accept`。

---

## 3. 交互闭环 API 覆盖（端到端实测）

对照《架构设计.md》§6 MVP Spike 的四项目标，**全部实起服务真实调用验证**：

| 架构诉求 | 端点 | 实测结果 |
|---|---|---|
| 对话流（SSE） | `GET /event`、`GET /session/:id/event` | ✅ 12s 采样收到 38 个事件，含 `message.part.delta`（流式增量）、`message.part.updated`、`session.diff`、`session.status`、`session.idle` |
| 发消息 | `POST /session/:id/message`（同步）、`POST /session/:id/prompt_async`（异步 204） | ✅ 同步调用返回完整 `{info, parts}` |
| Agent 任务/状态 | `/agent`、`/session/status`、`/session/:id/abort`、`/interrupt` | ✅ 会话创建、发起、idle 状态均可见 |
| 工具调用展示 | message 的 `Part[]`（`ToolPart`）+ SSE | ✅ 实测 SSE 推出 `tool=read` 的 `pending→running→completed` 完整状态机 |
| diff 视图 | `GET /session/:id/diff` + SSE `session.diff` | ✅ diff 端点返回；SSE 主动推送 `session.diff` |
| 看文件 | `GET /file`、`/file/content`、`/find*`、`/file/status` | ✅ git 项目根下 `/file/content?path=greeting.txt` 返回 `{"type":"text","content":"HELLO_FROM_API"}` |
| VCS | `GET /vcs/status` | ✅ 返回 `[{file, additions, deletions, status:"added"}]` |

### Part 类型（来自真实 spec，共 12 种）
`TextPart` `ReasoningPart` `ToolPart` `FilePart` `AgentPart` `SubtaskPart` `StepStartPart` `StepFinishPart` `SnapshotPart` `PatchPart` `RetryPart` `CompactionPart`
→ 足以还原「文本 / 推理 / 工具调用 / 文件 / 子任务 / 步骤 / 快照 / 补丁」的完整交互展示。

---

## 4. 文件读写能力（实测）

### 4.1 读：直连可用
`GET /file`（列目录）、`GET /file/content`（读内容）实测在 git 项目根下正常返回真实数据，前端可直接对接。

### 4.2 写：无专用写端点，经间接通道落盘
真实 spec 中**没有** `PUT /file/content` 这类直接写端点。写文件通过以下通道实现：

| 通道 | 机制 | 实测结果 |
|------|------|----------|
| **Agent write tool** | `POST /session/:id/message` 让 Agent 用内置 write/edit 工具改文件 | ✅ 已验证：请求后 `greeting.txt` 真实落盘，内容精确匹配 |
| **PTY 终端** | `POST /pty` 创建伪终端跑任意命令（含 `cwd`/`env`），`GET /pty/:id/connect` 走 WebSocket 交互，`/pty/:id/connect-token` 发短时令牌 | ✅ 已验证：用 PTY 跑 `echo > file` 真实写盘成功 |
| **VCS apply** | `POST /vcs/apply` 应用 raw patch 到工作树 | ⚠️ 未跑通：端点存在，但要求工作树 "clean"（`reason: non-git \| not-clean`），其 clean 判定基于 opencode 内部 snapshot 而非纯 git 状态，属边缘用途，需读源码确认可用性 |

**结论**：读靠 `/file*` 直连；写靠 Agent write tool 或 PTY 两条已验证通道。前端编辑器里的人工"保存"动作，需在集成层映射到写通道，而非 opencode 提供现成写 API。

> 补充事实：`/api/fs/*`（`/api/fs/read/*`、`/api/fs/list`、`/api/fs/find`）是另一套文件读取路由；`PATCH /session/:id/message/:messageID/part/:partID` 可更新 message part；`POST /session/:id/shell` 可在会话上下文跑 shell 并返回 AI 响应。

---

## 5. 官网文档 vs 真实 spec 的差异（事实）

- 官网 `/docs/server` 列约 60 个端点；**本地 v1.18.8 真实 spec 有 188 个**。
- 真实 spec 里新增/未文档化的成组能力：
  - **PTY 终端**：`/pty*`（7 个端点，含 WebSocket 连接）——对"终端视图"是关键。
  - **Workspace / Worktree / Sync**：`/experimental/workspace*`、`/experimental/worktree*`、`/sync/*`（steal/replay/start）——直接关联多租户工作区调度与会话迁移（`/experimental/control-plane/move-session`）。
  - **Integration / MCP OAuth**：`/api/integration/*`、`/mcp/:name/auth/*`。
  - **Permission / Question**：`/permission/*`、`/question/*` 双通道——Agent 可向前端要授权 / 提问，前端 reply。
- 结论：**必须以运行实例的 `/doc` 为准生成 SDK**，不能依赖官网文档。

---

## 6. 遗留问题 / 下一步

- [ ] `/vcs/apply` 的 "clean" 判定与 snapshot 机制细节（需读源码确认能否作为稳定写入通道）。
- [ ] PTY WebSocket（`/pty/:id/connect`）在浏览器扩展里的实测接入（已验证 PTY 创建+落盘；WS 交互流未验证）。
- [ ] `prompt_async` + SSE 的断线重连 / 会话恢复语义（支撑 §3.2 长连接路由）。
- [ ] `/experimental/workspace*` 与 `/sync/*` 是否可支撑架构 §3 的多租户调度（这批 API 是 warm pool / PVC 绑定的潜在解）。
- [ ] Experimental 标记端点的稳定性与版本兼容风险。

---

## 附录：复现方式

```bash
# 1. 起服务（在一个 git 项目根目录下）
cd <git-project-root>
opencode serve --port 4099

# 2. 抓真实 spec
curl -s http://127.0.0.1:4099/doc -H 'Accept: application/json' > spec.json

# 3. 列全部端点数
node -e 'const s=require("./spec.json");let n=0;for(const p in s.paths)n+=Object.keys(s.paths[p]).length;console.log(n)'

# 4. 端到端：建会话 → 发消息让 Agent 写文件 → 校验落盘 + vcs 状态
```

---

*本文档基于 opencode v1.18.8 实测。版本升级后 spec 可能变化，需以运行实例 `/doc` 为准复核。*
