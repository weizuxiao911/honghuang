FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

ARG EXTENSION_REGISTRY_URL=http://registry.taichu.localhost
ENV EXTENSION_REGISTRY_URL=${EXTENSION_REGISTRY_URL}

COPY tsconfig.json webpack.config.js ./
COPY src ./src

RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    DIST_DIR=/app/dist \
    ENV_FILE=/etc/taichu/.env

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server.ts ./

EXPOSE 8080

CMD ["node", "--experimental-strip-types", "server.ts"]