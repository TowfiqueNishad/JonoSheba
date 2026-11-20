FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/workers ./apps/workers

RUN pnpm install --filter @jonoshheba/workers... --no-frozen-lockfile
RUN pnpm --filter @jonoshheba/workers... build

CMD ["node", "apps/workers/dist/main.js"]
