# dongfu（洞府）标准化基础镜像契约
#
# 唯一事实源: ../设计文档.md 第四章「dongfu（洞府）」
# 镜像与业务能力完全解耦: 本镜像不预装任何业务 Agent;
#   业务 Agent 由 taixu 在 Pod 创建时通过 opencode.json 或 config 挂载注入。
# 调研参考（已沉淀、不再重写）: ../docs/opencode-server-api调研.md、
#   ../docs/opencode-事件流调研.md、../docs/架构设计.md

FROM node:22-slim

ENV TZ=Asia/Shanghai \
    DEBIAN_FRONTEND=noninteractive \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    OPENCODE_HOST=0.0.0.0 \
    OPENCODE_PORT=4096

# 系统基础工具: bash / ca-certificates / curl / git / tini(PID 1)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git tini \
    && rm -rf /var/lib/apt/lists/*

# 安装 opencode-ai 运行时
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g opencode-ai --omit=dev --no-audit --no-fund --loglevel=error \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*

# 持久化挂载点约定(PVC 在 Pod 创建时由 taixu 注入)
#   /workspace                       租户代码 + 项目级扩展 .opencode/
#   /root/.config/opencode           opencode.json + 全局级扩展(可按租户覆盖)
#   /root/.local/share/opencode      会话/DB/snapshot/凭证 auth.json(租户私有)
WORKDIR /workspace

EXPOSE 4096

# tini 作 PID 1 处理信号; opencode serve 监听全地址
# 业务 Agent 不在本 ENTRYPOINT 中加载, 全部由 taixu 运行时注入
ENTRYPOINT ["tini", "--", "opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]