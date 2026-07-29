# opencode 事件流调研

> 状态：**已完成实测验证**（v1.18.8，2026-07-29） · 关联文档：《opencode-server-api调研.md》§3
> 方法：本地 `oc-poc` 容器（`http://127.0.0.1:24096`），curl -N 挂 SSE，实发 `prompt_async` / v2 `prompt` 触发完整事件序列并采样。
> 原则：**事实说话**。下文每条结论均可复现。

---

## 1. 结论摘要

opencode v1.18.8 暴露**三套并存**的 SSE 事件端点，语义、包结构、事件粒度均不同：

| 端点 | 版本 | 事件包结构 | 事件粒度 | 断点重放 | 会话过滤 | 触发 API |
|---|---|---|---|---|---|---|
| `GET /event` | v1 | `{id, type, properties}` | 88 类，含空壳消息 | ❌ | 客户端过滤 | `POST /session/:id/prompt_async` |
| `GET /global/event` | v1 | `{directory, project, workspace, payload:{id,type,properties}}` | 同上，多路由字段 | ❌ | 客户端过滤 | 同上 |
| `GET /api/event` | v2 | `{id, type, data, durable:{aggregateID,seq,version}}` | 88 类，无空壳 | ✅ 会话内 `?after=seq` | 通过 `/api/session/:id/event` 单会话订阅 | `POST /api/session/:id/prompt` |

**关键差异（实测）**：
- **v2 事件更干净**：不推空壳的 `message.updated`，只推语义化的 `prompt.admitted / prompted / step.started / text.started / text.ended / step.ended`，序列 6 事件走完一轮问答。v1 同场景推 20+ 事件，含 `sync` / `session.status(busy)` / 双写 `.1` 后缀（v1/v2 兼容层）。
- **v2 durable**：每事件带 `durable.seq`（会话内自增）和 `aggregateID`（=sessionID），支持 `?after=seq` 断点重放，重连不丢事件。v1 无此能力。
- **v2 没有 text.delta**：实测 100 词英文回答只推一条 `text.ended`（含完整 text 字段），无中间增量。v1 才有 `session.next.text.delta` 逐字流。
- **v2 用不同模型**：v1 `POST /session/:id/prompt_async` 走会话配置的 provider（当前 401，volcengine-agent-plan）；v2 `POST /api/session/:id/prompt` 实测走 `opencode/ling-3.0-flash-free` 成功返回。**两者路由到不同的执行栈**，非同一 provider 配置。

**结论**：
- 生产用 v2 `/api/session/:id/event` + `?after=seq`（断线重连不丢消息）；发消息用 v2 `POST /api/session/:id/prompt`。
- 现有 chat-window 用的 v1 `/event` 是能跑，但事件冗余、无重放能力，只适合原型。
- `/global/event` 唯一价值是多路由字段（`directory/project/workspace`），K8s 一 Pod 一租户场景用不上。

---

## 2. 端点对比明细（实测）

### 2.1 事件类型总数
- v1 `/event`：`Event` schema 是 89 个 anyOf；`/global/event` 的 `GlobalEvent.payload` 是 88 个 anyOf。差 1 个是 `EventServerInstanceDisposed`，仅 `/event` 有。
- v2 `/api/event`：`V2Event` 是 88 个 anyOf，与 v1 一一对应但字段命名不同（v2 用 `data` 替代 `properties`，多 `durable` 字段）。

### 2.2 首个事件（连接后立刻收到）
| 端点 | 首条事件 |
|---|---|
| `/event` | `data: {"id":"evt_...","type":"server.connected","properties":{}}` |
| `/global/event` | `data: {"payload":{"id":"evt_...","type":"server.connected","properties":{}}}` |
| `/api/event` | `data: {"id":"evt_...","type":"server.connected","data":{}}` |

`/api/event` 长连观察到 `: heartbeat` 注释帧（默认 6~10s 一次），v1 端点未观察到心跳注释。

### 2.3 请求体 schema 差异

**v1 `POST /session/:id/prompt_async`**（沿用现有 chat-window）
```json
{
  "parts": [{ "type": "text", "text": "hi" }],
  "model": { "providerID": "...", "modelID": "..." },
  "agent": "build"
}
```
返回 204。

**v2 `POST /api/session/:id/prompt`**
```json
{
  "prompt": { "text": "hi" },
  "delivery": "steer",
  "resume": false
}
```
返回 `{ data: { admittedSeq, id, sessionID, prompt, delivery, timeCreated } }`——**同步返回 admittedSeq**，客户端可直接用它作为 SSE `?after=` 起点，天然支持"发消息-订阅事件"原子链路。

---

## 3. 事件序列对比（同一会话发同一条 prompt）

### 3.1 v1 `/global/event` 完整序列（发 `prompt_async{parts:[{type:"text",text:"hi"}]}`，401 场景）

采样 15s，收到 41 事件（含类型统计）：
```
9  sync                            ← v1 内部同步事件，与业务无关
4  session.status                  ← busy / idle 切换
4  message.updated                 ← 空壳先推，再补内容，最后加 error
4  message.updated.1               ← v1/v2 双写
3  session.updated / .1
2  text, idle, busy                ← 顶层生命周期
1  session.error / session.diff / session.created / server.heartbeat / message.part.updated
```

**空壳问题**：`message.updated` 至少推 4 次同一 msg_id：
1. 空壳 `{id, role, sessionID}`
2. 加 `parts.text` 完整消息
3. 补 agent/model 元数据
4. 出错时挂 `error` 字段

前端必须做去重和合并，否则 UI 抖动。

### 3.2 v2 `/api/session/:id/event` 完整序列（发 `{prompt:{text:"hi"}}`，成功场景）

采样 15s，收到**恰好 6 事件**，全部语义化：
```
seq=1  session.next.prompt.admitted   ← 用户 prompt 已入队
seq=2  session.next.prompted          ← 已开始处理
seq=3  session.next.step.started      ← assistant 消息 step 起
seq=4  session.next.text.started      ← 文本 part 起
seq=5  session.next.text.ended        ← 完整 text 一次性给
seq=6  session.next.step.ended        ← finish/cost/tokens 收尾
```

**无空壳、无双写、无冗余 sync**。前端按 seq 顺序 append 即可。

### 3.3 v2 断点重放（实测）

```bash
# 从 seq=3 之后重放：立即回放 seq=4/5/6 三个事件，然后转 live
curl -sN "http://127.0.0.1:24096/api/session/$SID/event?after=3"
```
实测：seq=4/5/6 一次性下发后连接保持，继续等新事件。这是唯一支持**断线不丢**的端点。

`?after=99`（不存在的 seq）：连接保持但无历史下发，直接进 live 模式。

---

## 4. 关键坑（实测）

1. **v1 和 v2 走不同执行栈**：v1 `prompt_async` 实测 401（provider 凭证问题），v2 `prompt` 同会话同一个 sessionID 却成功返回。原因是 v2 内部有独立的 model 路由（观察到 v2 fallback 到 `opencode/ling-3.0-flash-free`）。**两者不可混用**——用 v2 发消息就必须用 v2 收事件，否则会话状态可能对不齐。

2. **v2 无 text.delta**：想做逐字打字机效果的，**只能用 v1**。v2 只在 `text.ended` 一次性给完整文本。这是 v2 durable 模型的取舍——delta 太细碎，不适合作为持久化事件。

3. **v2 请求体不兼容 v1**：`{parts:[]}` 会被 v2 拒 `InvalidRequestError: Missing key at ["prompt"]`。v2 强制 `{prompt:{text}}` 结构，附件通过 `prompt.files[]` / `prompt.agents[]`。

4. **`/global/event` 的 `payload` 包装**：跟 `/event` 只差一层 `payload`，但 SDK 里对应的 method 不同（`client.global.event()` vs `client.event.subscribe()`）。若切换端点必须改事件解构：`ev.payload.type` vs `ev.type`。

5. **SSE 必须 `Accept: text/event-stream`**：不带的话会返回 HTML 或 500，与 `/doc` 同类坑。

---

## 5. 建议方案（生产落地）

### 5.1 chat-window 应改为 v2

**订阅**：
```ts
// 会话切换时：
const url = `/api/session/${sessionID}/event${lastSeq ? `?after=${lastSeq}` : ''}`;
// 每收到一个事件，更新 lastSeq = ev.durable.seq
```

**发消息**：
```ts
const { data } = await client.v2.session.prompt({
  path: { sessionID },
  body: { prompt: { text }, delivery: 'steer' }
});
// 立即拿到 admittedSeq，如需保证不漏第一个事件，SSE 用 ?after=admittedSeq-1
```

**处理器**（比 v1 简单得多）：
```
prompt.admitted    → 乐观显示用户消息
prompted           → 状态：处理中
step.started       → 新建 assistant 消息容器
text.started       → 新建 text part
text.ended         → 填入完整 text（无 delta 场景）
text.delta         → append 到当前 text part（若未来 v2 加了 delta）
tool.called / progress / success / failed → 工具卡片状态机
step.ended         → 收尾（tokens/cost）
prompt.rejected / retried → 错误处理
```

### 5.2 断点重连策略

state 里持久化 `lastSeq`（localStorage 或 IndexedDB）；SSE 断开重连时带 `?after=lastSeq`，可保证：
- 短时断线（网络抖动）：事件全部补齐
- 长时断线（切了会话又回来）：直接从 lastSeq 继续，不用重拉 `/message` 全量
- 冷启动（无 lastSeq）：先 `GET /api/session/:id/message` 拉全量，然后订阅 `?after=` 最后一条已知事件的 seq

### 5.3 什么时候还需要 `/global/event`

BFF 场景：网关代理多个 opencode 实例的事件到同一前端 SSE 时，用 `/global/event` 拿到 `directory/project/workspace` 三元组做路由分发。POC 阶段一 Pod 一租户，无此需求。

---

## 6. 遗留 / 下一步

- [ ] v2 `prompt` 的 `delivery: "queue"` 语义与 `"steer"` 差异（steer 立即处理，queue 排队？需实测）
- [ ] v2 `session.next.tool.*` 事件序列（当前采样只有纯文本回答，未触发工具调用）
- [ ] v2 是否有对应的 `session.error` 事件（v1 有，v2 待确认；若无则错误信号可能只在 `step.ended.finish` 或 `prompt.rejected` 里）
- [ ] v2 `durable.version` 字段作用（当前观察到 v1=1，`step.ended` v2=2，含义未明）
- [ ] SDK `client.v2.*` 命名空间是否稳定（v2 目录名字含 `v2/gen`，可能标记为实验性）

---

## 附录 A：复现命令

```bash
# 1. 采样 v1 /global/event（含空壳/双写）
(curl -sN --max-time 15 -H "Accept: text/event-stream" \
  http://127.0.0.1:24096/global/event > /tmp/global.log &)
sleep 1
SID=$(curl -s -X POST http://127.0.0.1:24096/session \
  -H "Content-Type: application/json" -d '{"title":"probe"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
curl -s -X POST "http://127.0.0.1:24096/session/$SID/prompt_async" \
  -H "Content-Type: application/json" -d '{"parts":[{"type":"text","text":"hi"}]}'
wait
grep -o '"type":"[^"]*"' /tmp/global.log | sort | uniq -c

# 2. 采样 v2 /api/session/:id/event（durable seq）
SID=$(curl -s -X POST http://127.0.0.1:24096/session \
  -H "Content-Type: application/json" -d '{"title":"v2-probe"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).id")
(sleep 0.5
 curl -s -X POST "http://127.0.0.1:24096/api/session/$SID/prompt" \
   -H "Content-Type: application/json" -d '{"prompt":{"text":"hi"}}') &
curl -sN --max-time 15 -H "Accept: text/event-stream" \
  "http://127.0.0.1:24096/api/session/$SID/event"
wait

# 3. v2 断点重放
curl -sN "http://127.0.0.1:24096/api/session/$SID/event?after=3"
```

---

*本文档基于 opencode v1.18.8 实测。事件类型总数和字段结构与 SDK v2 `dist/v2/gen/types.gen.d.ts` 交叉验证一致。*
