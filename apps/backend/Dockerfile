# Base image
FROM node:20-alpine AS base
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --no-frozen-lockfile

# Development
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# Generate Prisma client
WORKDIR /app/apps/api
RUN pnpm db:generate || true

EXPOSE 3001

CMD ["pnpm", "dev"]

# Production build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

WORKDIR /app/apps/api
RUN pnpm db:generate || true
RUN pnpm build

# Production
FROM base AS runner
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

CMD ["node", "dist/index.js"]

