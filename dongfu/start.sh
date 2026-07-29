#!/bin/bash
# dongfu（洞府）容器启动入口
# 单一职责：本地/CI 启动一个 dongfu 容器用于验证。
#
# 生产环境由 taixu 通过 K8s 调度创建 Pod,本脚本不参与生产部署。
#
# PVC 挂载契约（按 设计文档.md 第四章）:
#   workspace -> /workspace                  租户代码 + 项目级扩展 .opencode/
#   config    -> /root/.config/opencode      opencode.json + 全局扩展(taixu 注入)
#   data      -> /root/.local/share/opencode 会话/DB/snapshot/凭证(租户私有)
#
# 用户身份注入: USER_ID / TENANT_ID 等由 taixu 作为环境变量注入容器,
#   由 opencode 透传至 MCP 服务调用,不在 dongfu 内硬编码凭据。

set -e
cd "$(dirname "$0")"

IMG="${DONGFU_IMAGE:-honghuang/dongfu:dev}"
CTR="${DONGFU_CTR:-dongfu-dev}"
HOST_PORT="${DONGFU_PORT:-14096}"

mkdir -p workspace data config

docker rm -f "$CTR" 2>/dev/null || true

docker run -d \
  --name "$CTR" \
  --cpus=1 --memory=1g \
  -p "${HOST_PORT}:4096" \
  -v "$PWD/workspace:/workspace" \
  -v "$PWD/config:/root/.config/opencode" \
  -v "$PWD/data:/root/.local/share/opencode" \
  "$IMG"

echo "dongfu started: container=$CTR host_port=$HOST_PORT"
echo "verify: curl -s -H Accept:application/json http://127.0.0.1:${HOST_PORT}/global/health"