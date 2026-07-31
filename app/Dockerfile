FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts

COPY tsconfig.json webpack.config.js ./
COPY src ./src
COPY extensions ./extensions

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