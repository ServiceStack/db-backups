FROM oven/bun:1-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    postgresql16-client \
    mysql-client \
    gzip \
    curl

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package.json bun.lockb ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build Next.js application
RUN bun run build

# Production stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create user
RUN addgroup --system --gid 1001 bunuser && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:bunuser /app/.next/standalone ./
COPY --from=builder --chown=nextjs:bunuser /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:bunuser /app/public ./public

# Create directories for data
RUN mkdir -p /app/data/backups /app/data/db && \
    chown -R nextjs:bunuser /app/data

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["bun", "run", "server.js"]
