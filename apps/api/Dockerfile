FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache curl

# --- Bağımlılık katmanı ---
FROM base AS deps
WORKDIR /app

# Monorepo kök dosyaları
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
# Workspace paket tanımları
COPY packages/db/package.json ./packages/db/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile --config.block-exotic-subdeps=false

# --- Runtime katmanı ---
FROM base AS runner
WORKDIR /app

# node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules

# Kaynak kodlar
COPY packages/db/src ./packages/db/src
COPY packages/db/package.json ./packages/db/

COPY apps/api/src ./apps/api/src
COPY apps/api/package.json ./apps/api/package.json
COPY apps/api/tsconfig.json ./apps/api/tsconfig.json

RUN mkdir -p /app/data/sessions

ENV NODE_ENV=production
WORKDIR /app/apps/api

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "--import", "tsx/esm", "src/index.ts"]
