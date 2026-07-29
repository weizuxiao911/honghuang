#!/bin/bash
# 单一职责: 构建镜像
set -e
cd "$(dirname "$0")"
IMG=opencode-image
docker build -t "$IMG" .
