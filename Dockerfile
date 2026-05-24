# syntax=docker/dockerfile:1.7

# ----- Base: Node + system deps for headless rendering -----
FROM node:24-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        fontconfig \
        fonts-dejavu-core \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# Pin pnpm to match the lockfile generator (locally 10.33.4). pnpm 11.x introduced
# a `minimumReleaseAge` supply-chain policy that rejects packages published in the
# last 24h — we publish our own lib/docs deps and consume them immediately, so
# staying on pnpm 10 avoids that friction. CI's GitHub Action uses pnpm 11; that's
# independent of this image.
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"

# ----- Build: install all deps, compile TS, prepare dist/ -----
FROM base AS build
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
COPY bin ./bin
RUN pnpm run build

# ----- Prod deps only: clean node_modules for runtime image -----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile --prod \
    && pnpm store prune

# ----- Runtime: minimal image, non-root, healthcheck -----
FROM base AS runtime
ENV NODE_ENV=production \
    MCP_HTTP=1 \
    MCP_HOST=0.0.0.0 \
    MCP_TRUST_PROXY=1

COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist
COPY bin /app/bin
COPY package.json README.md LICENSE /app/

# Drop privileges; `node` user ships in the official image
USER node

# Container-level port (Railway maps its public 443 → this).
# Railway sets $PORT at runtime; the CLI reads it. EXPOSE is documentation.
EXPOSE 4321

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/healthz').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

# Use exec form so SIGTERM reaches the Node process for graceful shutdown.
CMD ["node", "bin/blueprint-chart-mcp.js"]
