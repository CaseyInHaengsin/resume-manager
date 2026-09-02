# syntax=docker/dockerfile:1.7

# Builder ---------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder

# better-sqlite3 ships prebuilt binaries; no native toolchain needed
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build

# Prune dev deps — runtime only needs production deps + better-sqlite3 native bindings
RUN pnpm prune --prod

# Runtime ---------------------------------------------------------------------
FROM node:22-bookworm-slim AS runner

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/scripts ./scripts

# Data volume location (sqlite db + uploads)
RUN mkdir -p /app/data/uploads \
  && chown -R node:node /app

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "mkdir -p data/uploads && node scripts/migrate.mjs && node ./node_modules/@react-router/serve/dist/cli.js ./build/server/index.js"]
