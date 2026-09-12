FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/kcs-contract ./packages/kcs-contract
COPY apps/web ./apps/web
RUN pnpm install --filter @kcs/web... --frozen-lockfile=false
WORKDIR /app/apps/web
EXPOSE 7001
CMD ["pnpm", "dev"]
