# syntax=docker/dockerfile:1.7
# KCS API (Hono). Build from the repository root:
#   docker build -f apps/api/Dockerfile -t kcs-api .
# The runtime stage holds only the esbuild bundle (dependencies inlined) plus the
# migrations / fixtures it reads at runtime — no node_modules, no tsx, no sources.

FROM node:22-bookworm-slim AS build
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.4.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/kcs-contract/package.json packages/kcs-contract/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=kcs-pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --filter @kcs/api... --frozen-lockfile --ignore-scripts
COPY packages/kcs-contract packages/kcs-contract
COPY apps/api apps/api
RUN pnpm --filter @kcs/api build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=7100
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /repo/apps/api/dist ./dist
USER node
EXPOSE 7100
# /api/health queries the database; it answers 503 while draining on SIGTERM.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||7100)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# node is PID 1 (no pnpm / shell wrapper) so SIGTERM reaches the graceful-shutdown handler.
STOPSIGNAL SIGTERM
CMD ["node", "--enable-source-maps", "dist/src/index.mjs"]
