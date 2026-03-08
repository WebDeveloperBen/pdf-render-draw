# Stage 1: Build
# Docker context should be the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace config + lockfile
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

# Install dependencies (workspace-aware)
RUN pnpm install --frozen-lockfile --filter @pdf-annotator/web

# Copy web app source
COPY apps/web/ apps/web/
ENV NODE_ENV=production
RUN pnpm --filter @pdf-annotator/web build

# Stage 2: Production
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000

# Copy built output
COPY --from=builder /app/apps/web/.output .output

# Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nuxt
USER nuxt

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
