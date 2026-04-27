# =============================================================
# A-idol — Make targets for local development
# =============================================================

SHELL := /bin/bash

.PHONY: help bootstrap install up down reset dev migrate seed studio typecheck lint test clean smoke

help:
	@echo ""
	@echo "A-idol local development — common tasks"
	@echo "----------------------------------------"
	@echo "  make bootstrap   First-time setup: copy .env, install, up, migrate, seed"
	@echo "  make install     Install dependencies (pnpm install)"
	@echo "  make up          Start PostgreSQL + Redis (docker compose)"
	@echo "  make down        Stop containers"
	@echo "  make reset       Destroy volumes and restart a fresh DB"
	@echo "  make migrate     Run Prisma migrations"
	@echo "  make seed        Seed local data"
	@echo "  make studio      Open Prisma Studio (DB inspector)"
	@echo "  make dev         Run backend in watch mode"
	@echo "  make typecheck   Run tsc --noEmit across the workspace"
	@echo "  make lint        Run ESLint across the workspace"
	@echo "  make test        Run unit tests"
	@echo "  make smoke       curl health + signup + login + me"
	@echo "  make clean       Remove node_modules and build outputs"
	@echo ""

bootstrap:
	@test -f .env || cp .env.example .env
	@$(MAKE) install
	@$(MAKE) up
	@echo "Waiting for PostgreSQL..."
	@for i in $$(seq 1 30); do \
	  docker compose exec -T postgres pg_isready -U aidol -d aidol > /dev/null 2>&1 && break; \
	  sleep 1; \
	done
	@$(MAKE) migrate
	@$(MAKE) seed
	@echo "✅ Ready. Run: make dev"

install:
	pnpm install

up:
	docker compose up -d postgres redis

down:
	docker compose down

reset:
	docker compose down -v
	docker compose up -d postgres redis

dev:
	pnpm --filter @a-idol/backend dev

migrate:
	pnpm --filter @a-idol/backend prisma:migrate

seed:
	pnpm --filter @a-idol/backend seed

studio:
	pnpm --filter @a-idol/backend prisma:studio

typecheck:
	pnpm -r typecheck

lint:
	pnpm -r lint

test:
	pnpm -r test

smoke:
	@echo "— /health —"
	@curl -s http://localhost:3000/health | tee /dev/null; echo
	@echo "— POST /auth/signup —"
	@curl -s -X POST http://localhost:3000/auth/signup \
	  -H "Content-Type: application/json" \
	  -d '{"email":"demo@a-idol.dev","password":"password123","nickname":"demo","birthdate":"2000-01-01"}' | tee /tmp/signup.json; echo
	@echo "— POST /auth/login —"
	@ACCESS=$$(curl -s -X POST http://localhost:3000/auth/login \
	  -H "Content-Type: application/json" \
	  -d '{"email":"demo@a-idol.dev","password":"password123"}' | tee /tmp/login.json | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).accessToken))"); \
	  echo "access token: $$ACCESS"; \
	  echo "— GET /me —"; \
	  curl -s http://localhost:3000/me -H "Authorization: Bearer $$ACCESS"; echo

clean:
	find . -name node_modules -type d -prune -exec rm -rf '{}' +
	find . -name dist -type d -prune -exec rm -rf '{}' +
	find . -name '*.tsbuildinfo' -delete
