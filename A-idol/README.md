# A-idol — Local Dev Quickstart

> AI 아이돌 팬덤 플랫폼. 이 레포는 **백엔드 + DB 스캐폴딩**을 우선 제공합니다. Mobile(RN) / CMS(React) 패키지는 다음 단계에서 추가됩니다.

## Prerequisites (사전 요구사항)

- **Node.js** 20.10+
- **pnpm** 9+ (권장) — `npm install -g pnpm`
- **Docker Desktop** (PostgreSQL/Redis 컨테이너 실행용)
- **Git**
- macOS/Linux/WSL2 환경 권장

## 5-minute Quickstart

```bash
# 1. 환경변수 파일 준비
cp .env.example .env

# 2. 의존성 설치
pnpm install

# 3. DB/Redis 컨테이너 기동
docker compose up -d postgres redis
# or: make up

# 4. DB 마이그레이션
pnpm migrate
# or: make migrate

# 5. 시드 데이터 주입 (1 agency + 3 idols + 3 fan clubs)
pnpm seed
# or: make seed

# 6. 백엔드 개발 서버 실행
pnpm dev
# -> http://localhost:3000
```

모든 단계를 한번에:

```bash
make bootstrap   # .env 복사 → install → up → migrate → seed
make dev         # 서버 실행
```

## Smoke Test (동작 확인)

서버 실행 후 새 터미널에서:

```bash
make smoke
# 또는 수동으로:
curl http://localhost:3000/health

curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@a-idol.dev","password":"password123","nickname":"demo","birthdate":"2000-01-01"}'

curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@a-idol.dev","password":"password123"}'
# => { "accessToken": "...", "refreshToken": "...", "user": { ... } }

curl http://localhost:3000/me \
  -H "Authorization: Bearer <accessToken>"

curl http://localhost:3000/idols
```

## Useful URLs

| URL | Purpose |
|-----|---------|
| http://localhost:3000/health | 백엔드 헬스체크 |
| http://localhost:3000/docs   | OpenAPI Swagger UI |
| http://localhost:8080        | Adminer (server=postgres, user=aidol / pwd=aidol_dev / db=aidol) — 호스트에서 직접 접근 시 `localhost:5433` |
| http://localhost:5555        | Prisma Studio (`make studio`) |

## Repo Layout

```
a-idol/
├─ packages/
│  ├─ shared/                 # 도메인 엔티티, 에러, DTO 계약 (@a-idol/shared)
│  └─ backend/                # NestJS + Prisma (@a-idol/backend)
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ seed.ts
│     └─ src/
│        ├─ config/
│        ├─ shared/           # Prisma service, guards, filters, logger
│        └─ modules/
│           ├─ health/
│           ├─ identity/      # Clean Architecture 레이어링 예시
│           │  ├─ domain/
│           │  ├─ application/
│           │  ├─ infrastructure/
│           │  └─ presentation/
│           └─ catalog/
├─ docs/                      # SDLC 문서 (기획/설계/개발계획/WBS/정책)
├─ sql/                       # 전체 DDL (참고용; 실제 마이그레이션은 Prisma)
├─ .claude/commands/          # Claude Code slash command 템플릿
├─ CLAUDE.md                  # 프로젝트 컨텍스트 (Claude Code가 자동 로드)
├─ docker-compose.yml
├─ Makefile
├─ package.json  (pnpm workspace root)
└─ pnpm-workspace.yaml
```

## Using Claude Code

이 레포는 Claude Code 친화적으로 구성되었습니다.

```bash
cd a-idol
claude    # Claude Code 실행 (설치: https://docs.claude.com/en/docs/claude-code)
```

Claude Code가 자동으로 `CLAUDE.md`를 읽고, `.claude/commands/`의 slash 명령을 인식합니다.

사용 가능한 슬래시 명령:

| Command | Purpose |
|---------|---------|
| `/dev-up`      | 부트스트랩(install → docker → migrate → seed → dev) |
| `/migrate`     | Prisma 마이그레이션 생성 및 적용 |
| `/seed`        | 로컬 시드 실행 |
| `/test`        | 테스트 실행 |
| `/new-feature` | Clean Architecture 패턴으로 새 기능 모듈 추가 |

## Troubleshooting

**`Cannot connect to DB` / `ECONNREFUSED 5432`**
→ `docker compose ps`로 postgres 상태 확인. 미기동이면 `make up`.

**`Migration failed`**
→ `make reset` 후 `make migrate`. (⚠️ 로컬 데이터 삭제됨)

**`Port 3000 already in use`**
→ `.env`의 `PORT` 변경, 또는 `lsof -i :3000`으로 충돌 프로세스 확인.

**`pnpm: command not found`**
→ `npm install -g pnpm@9` 또는 `corepack enable pnpm`.

## Next Steps

- CMS 패키지 (`packages/cms`): Vite + React + shadcn/ui
- Mobile 패키지 (`packages/mobile`): React Native 0.74
- GitHub Actions CI (lint, test, build)
- Staging 인프라 (ECS + RDS)

자세한 로드맵은 [`docs/implementation/a-idol-dev-plan.md`](docs/implementation/a-idol-dev-plan.md) · WBS는 [`docs/implementation/a-idol-wbs.md`](docs/implementation/a-idol-wbs.md).
