FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

# --- Bağımlılık katmanı ---
FROM base AS deps
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/admin/package.json ./apps/admin/

RUN pnpm install --frozen-lockfile --config.block-exotic-subdeps=false

# --- Build katmanı ---
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin/node_modules ./apps/admin/node_modules

COPY apps/admin ./apps/admin

# WS URL: bake-time arg (Portainer build args ile ayarlanabilir)
# API_URL: runtime'da set edilir, NOT baked in
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3000
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

WORKDIR /app/apps/admin
RUN pnpm build

# --- Runtime katmanı ---
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# API_URL: runtime'da Docker Compose / Portainer tarafından set edilir
# Proxy route.ts bu değişkeni kullanır (NEXT_PUBLIC_ değil)

COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/ || exit 1

CMD ["node", "apps/admin/server.js"]
