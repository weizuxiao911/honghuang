# 调研验证产物

本目录为**前期可运行的调研验证产物**，用于在立项前实测各底层开源组件的可行性、关键路径与坑点。所有验证均已在本机端到端跑通。

**正式工程以根目录 [`../设计文档.md`](../设计文档.md)（产品蓝图）与四模块目录（[`../zifu/`](../zifu/) · [`../langhuan/`](../langhuan/) · [`../taixu/`](../taixu/) · [`../dongfu/`](../dongfu/)）为准**。本目录代码仅作只读参考，不作为正式工程的一部分，后续按需迁移或废弃。

## 已跑通的验证

| 子目录 | 对应正式模块 | 验证目标 | 状态 |
|--------|--------------|----------|------|
| [`opencode-docker/`](./opencode-docker/) | [dongfu](../dongfu/)（洞府） | opencode Docker 化、188 API 全通、扩展可注入、长任务不 OOM | ✅ |
| [`opensumi-web/`](./opensumi-web/) | [zifu](../zifu/)（紫府） | OpenSumi/CodeBlitz 纯容器本地跑通；`DynamicRequest` 读 + PTY 写回 | ✅ |
| [`agent-extensions/`](./agent-extensions/) | [zifu](../zifu/) 的 VSIX 扩展 | 自研 vsix（会话管理 / 对话窗口）源码；esbuild 打包；vsce 出 `.vsix` | ✅ |
| [`extension-registry/`](./extension-registry/) | [langhuan](../langhuan/)（琅嬛） | vsix 扫描 → metadata → HTTPS 分发；opensumi-web 运行时集成端到端跑通 | ✅ |

**未覆盖**：[taixu](../taixu/)（太虚）在 POC 阶段未实现；其早期独立调研与原型实现已沉淀至会话与调研文档，正式实施时按设计文档第三章规划重建。

## 调研参考（结论沉淀）

技术结论已沉淀至 [`../docs/`](../docs/) 调研文档集：

- [`../docs/opencode-server-api调研.md`](../docs/opencode-server-api调研.md)
- [`../docs/opencode-事件流调研.md`](../docs/opencode-事件流调研.md)
- [`../docs/opensumi-opencode前后端分离调研.md`](../docs/opensumi-opencode前后端分离调研.md)
- [`../docs/vsix扩展开发标准调研.md`](../docs/vsix扩展开发标准调研.md)
- [`../docs/vsix扩展分发管理调研.md`](../docs/vsix扩展分发管理调研.md)
- [`../docs/架构设计.md`](../docs/架构设计.md)

## 运行状态（历史记录）

- opencode 后端容器 `oc-poc`（仅本机）：宿主端口 `24096` → 容器 `4096`。
- health: `curl -s -H Accept:application/json http://127.0.0.1:24096/global/health`
- CORS 默认全放行（实测反射任意 `Origin`），前端任意端口可直连。

> 这些验证已固化事实，运行细节后续按需重启或重建；正式工程的部署方式以四模块各自的工程规范为准。

## 命名说明

本目录下的子目录命名遵循早期调研阶段的**英文功能命名**（如 `opencode-docker`），与正式工程的**中文模块命名**（zifu / langhuan / taixu / dongfu）存在一对多映射：

- `opencode-docker` ⊂ dongfu（洞府）的核心运行时基础。
- `opensumi-web` ⊂ zifu（紫府）的容器骨架。
- `agent-extensions` ⊂ zifu 的业务扩展层。
- `extension-registry` ⊂ langhuan（琅嬛）的核心分发能力。

迁移到正式工程时按对应模块的目录结构与 `.gitignore` 重整。