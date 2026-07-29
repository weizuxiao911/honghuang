# opencode Docker 化验证

> 调研目标:验证 opencode serve 能否打包成 Docker 镜像跑、`1C1G` 下能否正常工作、核心 API 闭环能否通。

---

## 文件

| 文件 | 职责 |
|------|------|
| `Dockerfile` | 基于 node:22-slim 安装 opencode-ai,tini 作 PID 1 |
| `build.sh` | 只构建镜像 `opencode-image` |
| `start.sh` | 只启动容器 `oc-poc`(1C1G,端口 24096,挂 workspace/auth/config) |
| `api.http` | REST Client 格式的 API 验证集合(VS Code 逐条 Send Request) |
| `workspace/` | 挂载进容器 `/workspace` 的工作区(git 仓库) |

---

## 结论

- ✅ **Docker 镜像构建成功**,opencode-ai npm 包可直接装在 node:22-slim 上,`npmmirror` 镜像加速构建
- ✅ **1C1G 容器可用**:空载内存 ~743MiB(占配额 72.56%),核心进程常驻 ~710MB,CPU 空闲 ~0.5%
- ✅ **0.5C/512M 容器可用(实测压测通过)**:空载 ~294MiB(57%),多文件项目构建长任务峰值 511MiB(99.86%),未 OOM,6 个产物全部落盘
- ✅ **12 项 API 闭环全部跑通**:health、spec(188 端点)、读文件、列目录、创建 session、SSE 事件流、发消息、Agent 写落盘、diff、PTY 写落盘、VCS 状态

### 资源配额结论

opencode 内存会**按 cgroup 限额自适应收敛**:

| 配额 | 空载 | 长任务峰值 | 结论 |
|------|------|------------|------|
| 1C1G | ~743MiB (73%) | 未测大任务 | 宽松够用,余量充足 |
| 0.5C/512M | ~294MiB (57%) | ~511MiB (99.86%) | 可用,但跑复杂 Agent 任务时顶到极限,不建议生产压满用 |

> 注意:0.5C/512M 下长任务不会 OOM,但内存触及 100% 时 CPU 会显著升高(gc),响应变慢。生产建议留 15-20% 余量。

---

## 运行方式

```bash
cd poc/opencode-docker

# 1. 构建镜像
bash build.sh
# 镜像 opencode-image 构建完成

# 2. 启动 1C1G 容器
bash start.sh
# 容器 oc-poc 启动,端口 24096
# 宿主机 workspace/ 挂载进 /workspace

# 3. 验证
# 用 api.http (VS Code REST Client) 或 curl 手动调用:
curl -s -H Accept:application/json http://127.0.0.1:24096/global/health

# 4. 停止容器
docker rm -f oc-poc
```

---

## 实测结果

### 1. 资源基线(1C1G)

```
空载 CPU: 0.39-0.85%
空载内存: 743MiB / 1GiB (72.56%)

容器内进程内存 top:
  728,076 kB  opencode
  108,484 kB  node
   82,904 kB  npm
```

> 内存基线高:opencode 主进程空载就吃 ~710MB,留给 Agent 执行的余量 ~280MB。

### 2. API 验证结果(全部通过,对应 api.http 各请求块)

| # | 项 | 结果 |
|---|---|---|
| 0 | global/health | healthy, version=1.18.8 ✅ |
| 1 | /doc OpenAPI | 188 个端点 ✅ |
| 2 | /file/content | seed.txt 内容正确 ✅ |
| 3 | /file list | seed.txt 列目录取出 ✅ |
| 4 | POST /session | session 创建成功 ✅ |
| 5 | SSE /event | 事件流收到 ✅ |
| 6 | POST /session/:id/message | Assistant 响应 ✅ |
| 7 | Agent 写落盘 | agent-written.txt 内容正确 ✅ |
| 8 | /session/:id/diff | http=200 ✅ |
| 9 | PTY 创建 | 成功 ✅ |
| 10 | PTY 写落盘 | pty-written.txt 内容正确 ✅ |
| 11 | /vcs/status | 新增文件正确识别 ✅ |

### 3. 长任务压测(0.5C/512M)

任务:让 Agent 一次性构建一个 Node 项目(6 步:项目结构 + package.json + math.js + string-utils.js + 测试 + README + .gitignore),`prompt_async` 异步提交,每秒采样内存。

```
空载:       294MiB / 512MiB (57%)
任务中峰值:  511.3MiB / 512MiB (99.86%)
任务后回落:  ~440MiB
OOMKilled:  false     Restarts: 0
```

Agent 消息流:`todowrite`(任务清单)→ 多轮 `write` + `patch`,全程走完。

产物(全部真实落盘):

| 文件 | 行数 |
|------|------|
| package.json | 16 |
| src/math.js | 20 |
| src/string-utils.js | 19 |
| test/math.test.js | 27 |
| README.md | 47 |
| .gitignore | 8 |

> 事实:512M 顶到 99.86% 也没 OOM,任务完整完成。但已无余量,不建议生产压满用。

---

## 架构映射

本 POC 验证的是架构文档 §2.2 **后端能力层单实例**的可运行性:

- `1C1G` 是架构 §3.4 "资源配额"的基线值,已跑通核心能力
- 工作区通过 volume 挂载,对应 §3.4 PVC 挂载 `/workspace`
- API 全通,意味着前端层(自研 vsix / OpenSumi lite)的 HTTP 对接可行
- auth.json 宿主机挂载验证了多租户下如何注入凭证

---

## 遗留问题(待后续调研)

- 并发 session 数:单工作区下最多能跑多少会话/多少并发 prompt?
- 内存随 session 数的增长曲线
- CPU 瓶颈点(Token 生成速度?)
- ~~单个长任务 OOM 概率~~ → 已测:0.5C/512M 单任务顶到 99.86% 未 OOM;但**并发多任务**下的 OOM 概率仍未测
- 多实例密度:一台宿主机能跑多少个这样的容器(含超售比)
