FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/kcs-contract ./packages/kcs-contract
COPY apps/api ./apps/api
RUN pnpm install --filter @kcs/api... --frozen-lockfile=false
WORKDIR /app/apps/api
EXPOSE 7100
CMD ["pnpm", "start"]
