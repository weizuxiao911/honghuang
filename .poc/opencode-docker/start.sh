#!/bin/bash
# 单一职责: 启动容器 (1C1G, 全部挂载 PWD 下本地目录)
# 生产环境这三个挂载均为 per-租户 PVC:
#   workspace -> /workspace                  租户代码 + 项目级扩展 .opencode/
#   data      -> /root/.local/share/opencode 会话/DB/snapshot/凭证 auth.json (租户私有状态)
#   config    -> /root/.config/opencode      opencode.json + 全局级扩展 (可共享或按租户覆盖)
set -e
cd "$(dirname "$0")"
IMG=opencode-image
CTR=oc-poc

docker rm -f "$CTR" 2>/dev/null || true
docker run -d \
  --name "$CTR" \
  --cpus=1 --memory=1g \
  -p 24096:4096 \
  -v "$PWD/workspace:/workspace" \
  -v "$PWD/config:/root/.config/opencode" \
  -v "$PWD/data:/root/.local/share/opencode" \
  "$IMG"
