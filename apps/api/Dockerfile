FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/api ./apps/api

RUN pnpm install --filter @jonoshheba/api... --no-frozen-lockfile
RUN pnpm --filter @jonoshheba/api... build

EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
