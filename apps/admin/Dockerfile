FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Bağımlılık katmanı ---
FROM base AS deps
WORKDIR /app

# Workspace kök + tüm paket tanımları (pnpm workspace bunları bekliyor)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages/db/package.json ./packages/db/
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile --config.block-exotic-subdeps=false

# --- Build katmanı ---
FROM base AS builder
WORKDIR /app

# node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules

# Kaynak kodlar
COPY packages/db/src ./packages/db/src
COPY packages/db/package.json ./packages/db/
COPY apps/admin ./apps/admin
COPY package.json pnpm-workspace.yaml ./

# Build workspace root'tan çalıştır
RUN pnpm --filter @wapi/admin build

# --- Runtime katmanı ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# outputFileTracingRoot=../.. ile standalone monorepo kökünden çıkıyor
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
# Not: apps/admin/public boş olduğundan kopyalanmıyor (git boş klasör saklamaz)

EXPOSE 3001

# wget BusyBox'ta her zaman güvenilir değil → node ile HTTP kontrolü
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/', (r) => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))" || exit 1

CMD ["node", "apps/admin/server.js"]
