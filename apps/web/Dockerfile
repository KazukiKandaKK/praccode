# Base image
FROM node:20-alpine AS base
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl openssl-dev
RUN corepack enable && corepack prepare pnpm@9.14.2 --activate
WORKDIR /app

# Dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --no-frozen-lockfile

# Development
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

# Generate Prisma Client for web app
WORKDIR /app/apps/api
RUN pnpm db:generate || true

WORKDIR /app/apps/web

EXPOSE 3000

CMD ["pnpm", "dev"]

# Production build
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .

WORKDIR /app/apps/web

ENV NEXT_TELEMETRY_DISABLED=1

# Generate Prisma Client for web app
# Copy schema and generate client in web's node_modules
RUN cp -r ../api/prisma ./prisma-temp || true
RUN pnpm prisma generate --schema=./prisma-temp/schema.prisma || true
RUN rm -rf ./prisma-temp || true

RUN pnpm build

# Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./public

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

