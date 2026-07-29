FROM node:22-slim

ENV TZ=Asia/Shanghai \
    DEBIAN_FRONTEND=noninteractive \
    NPM_CONFIG_UPDATE_NOTIFIER=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash ca-certificates curl git tini \
    && rm -rf /var/lib/apt/lists/*

# 配置 npm 镜像（中国网络环境）
RUN npm config set registry https://registry.npmmirror.com \
    && npm install -g opencode-ai --omit=dev --no-audit --no-fund --loglevel=error \
    && npm cache clean --force \
    && rm -rf /root/.npm /tmp/*

# 工作区为运行时挂载的 volume，不烤进镜像
WORKDIR /workspace

EXPOSE 4096

# tini 作 PID 1 处理信号，opencode serve 监听 0.0.0.0 供容器外 curl
ENTRYPOINT ["tini", "--", "opencode", "serve", "--hostname", "0.0.0.0", "--port", "4096"]
