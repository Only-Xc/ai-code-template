# 多阶段构建：pnpm workspace → prisma generate → nest build → 运行
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache curl
WORKDIR /app

# deps：先装 workspace 依赖，利用层缓存
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
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
COPY --from=build /app/apps/backend /app/apps/backend
WORKDIR /app/apps/backend
ENV PATH="/app/apps/backend/node_modules/.bin:$PATH"
EXPOSE 3000
CMD ["node", "dist/src/main"]
