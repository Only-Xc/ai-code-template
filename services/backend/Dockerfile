# 多阶段构建：pnpm workspace → prisma generate → nest build → 运行
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache curl tini
WORKDIR /app

# deps：先装 workspace 依赖，利用层缓存
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY services/backend/package.json services/backend/package.json
COPY packages/tooling/package.json packages/tooling/package.json
COPY packages/utils/package.json packages/utils/package.json
RUN pnpm install --frozen-lockfile

# build：复制源码，生成 Prisma Client 并编译
FROM deps AS build
COPY . .
RUN pnpm --filter @template/backend prisma:generate
RUN pnpm --filter @template/backend build

# runner：携带完整依赖（含 prisma CLI 供 migrate deploy）与构建产物
FROM base AS runner
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/packages /app/packages
COPY --from=build /app/services/backend /app/services/backend
WORKDIR /app/services/backend
ENV PATH="/app/services/backend/node_modules/.bin:$PATH"
EXPOSE 3000

# 非 root 运行 + tini 收割僵尸进程
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD curl -f http://localhost:3000/api/readyz || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main"]
