FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
COPY vsix ./vsix

ARG PUBLIC_HOST=registry.taichu.localhost
ENV PUBLIC_HOST=${PUBLIC_HOST}

RUN npm run build

FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY src ./src
COPY vsix ./vsix
COPY certs ./certs

EXPOSE 9000

CMD ["node", "--experimental-strip-types", "src/server.ts"]