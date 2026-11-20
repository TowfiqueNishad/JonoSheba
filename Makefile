.PHONY: up up-full down reset logs ps doctor dev test lint typecheck db-migrate db-seed sdk-generate

COMPOSE := docker compose

up:
	$(COMPOSE) up -d

up-full:
	$(COMPOSE) --profile opensearch --profile ollama up -d

down:
	$(COMPOSE) down

reset:
	$(COMPOSE) down -v --remove-orphans
	$(COMPOSE) up -d

logs:
	$(COMPOSE) logs -f --tail=100

ps:
	$(COMPOSE) ps

doctor:
	bash scripts/doctor.sh

dev:
	pnpm dev

test:
	pnpm test
	pnpm ai:test

lint:
	pnpm lint
	pnpm ai:lint

typecheck:
	pnpm typecheck
	pnpm ai:typecheck

db-migrate:
	pnpm db:migrate

db-seed:
	pnpm db:seed

sdk-generate:
	pnpm sdk:generate
