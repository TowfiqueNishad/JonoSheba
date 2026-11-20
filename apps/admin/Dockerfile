FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY apps/admin ./apps/admin

RUN pnpm install --filter @jonoshheba/admin... --no-frozen-lockfile
RUN pnpm --filter @jonoshheba/admin... build

EXPOSE 3001
CMD ["pnpm", "--filter", "@jonoshheba/admin", "start"]
