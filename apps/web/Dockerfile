FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app

COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages ./packages
COPY data ./data
COPY apps/api ./apps/api
COPY apps/web ./apps/web

RUN pnpm install --filter @jonoshheba/web... --no-frozen-lockfile
RUN pnpm --filter @jonoshheba/web... build

EXPOSE 3000
CMD ["pnpm", "--filter", "@jonoshheba/web", "start"]
