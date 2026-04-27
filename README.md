# A-idol — Local Dev Quickstart

> AI 아이돌 팬덤 플랫폼. **백엔드 도메인 모듈 10개 구현 완료** (~65% WBS). Mobile(RN) / CMS(React) 패키지는 다음 단계입니다.

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

# 5. 시드 데이터 주입
pnpm seed
# or: make seed

# 6. 백엔드 개발 서버 실행
pnpm dev
# -> http://localhost:3000
```

한 번에:

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
│  ├─ shared/                     # @a-idol/shared — 도메인 엔티티 · 에러 · DTO 계약
│  ├─ backend/                    # @a-idol/backend — NestJS + Prisma
│  │  └─ src/modules/
│  │     ├─ identity/             # 회원가입 · 로그인 · OAuth (Kakao/Apple/Google)
│  │     ├─ catalog/              # 아이돌 · 소속사 · 스케줄 · 이미지
│  │     ├─ fandom/               # 하트 · 팔로우 · 팬클럽 · 멤버십
│  │     ├─ chat/                 # 채팅방 · 쿼터/쿠폰 · 자동 응답 · WebSocket
│  │     ├─ commerce/             # IAP 상품 · 거래 · 샌드박스 검증
│  │     ├─ audition/             # 오디션 · 라운드 · 엔트리 · 투표 규칙
│  │     ├─ vote/                 # 하트/티켓/SMS 가중치 투표 · 리더보드
│  │     ├─ photocard/            # 포토카드 템플릿 · 가챠 · 수집
│  │     ├─ admin-ops/            # CMS 인증 · 분석 대시보드
│  │     └─ health/               # Liveness / readiness
│  ├─ cms/                        # (placeholder) React CMS
│  └─ mobile/                     # (placeholder) React Native 앱
├─ docs/                          # SDLC 산출물 + 참조 규약 (상세: docs/README.md)
│  ├─ analysis/                   # 요구사항 분석
│  ├─ design/                     # 아키텍처 · ERD · 시퀀스 · 정책 · UI 스펙
│  ├─ implementation/             # 개발 계획 · WBS · Phase 체크리스트
│  ├─ adr/                        # Architecture Decision Records (ADR-010~019)
│  ├─ ops/                        # 운영 런북 · 성능 베이스라인
│  ├─ legal/                      # 법무 브리프 (청소년 결제 한도 등)
│  ├─ support/                    # FAQ
│  ├─ reference/                  # 외부 참고 자료 스냅샷
│  └─ amb-starter-kit/            # Amoeba 플랫폼 v2.0 표준 (CLAUDE.md 편차표 참고)
├─ sql/                           # 전체 DDL (참고용; 실제 마이그레이션은 Prisma)
├─ .claude/commands/              # Claude Code slash command 템플릿
├─ CLAUDE.md                      # 프로젝트 컨텍스트 (Claude Code 자동 로드)
├─ docker-compose.yml             # postgres:5433 · redis:6379 · adminer:8080
├─ Makefile
└─ pnpm-workspace.yaml
```

## Development Conventions (요약)

상세 규약은 [`CLAUDE.md`](CLAUDE.md)를 참고하세요. 핵심만 요약:

- **아키텍처**: Clean Architecture 4계층 (`domain → application → infrastructure → presentation`). 모듈 간 의존은 `@a-idol/shared` 계약 경유.
- **DTO 케이스**: Request = `snake_case`, Response = `camelCase` (amb-starter-kit 규약). 기존 백엔드 Request DTO는 camelCase — Phase D에 마이그레이션 예정.
- **i18n**: `ko` / `en` / `vi` / `zh-CN` 4개 언어, 하드코딩 금지.
- **RBAC**: `User`(모바일) + `AdminUser`(CMS) 2단계 (A-idol 단순화).
- **커밋**: Conventional Commits + scope. 예) `feat(chat): add reply engine`.
- **브랜치**: `feature/<issue>-<desc>`, `bugfix/<issue>-<desc>`, `docs/<issue>-<desc>`.
- **참조 규약 전문**: [`docs/amb-starter-kit/`](docs/amb-starter-kit/) + [`CLAUDE.md`](CLAUDE.md)의 "amb-starter-kit 편차표".

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
| `/dev-up`      | 부트스트랩 (install → docker → migrate → seed → dev) |
| `/migrate`     | Prisma 마이그레이션 생성 및 적용 |
| `/seed`        | 로컬 시드 실행 |
| `/test`        | 테스트 실행 |
| `/new-feature` | Clean Architecture 패턴으로 새 기능 모듈 추가 |

## Troubleshooting

**`Cannot connect to DB` / `ECONNREFUSED 5432`**
→ `docker compose ps`로 postgres 상태 확인. 미기동이면 `make up`. 호스트 측 포트는 `5433`입니다.

**`Migration failed`**
→ `make reset` 후 `make migrate`. (⚠️ 로컬 데이터 삭제됨)

**`Port 3000 already in use`**
→ `.env`의 `PORT` 변경, 또는 `lsof -i :3000`으로 충돌 프로세스 확인.

**`pnpm: command not found`**
→ `npm install -g pnpm@9` 또는 `corepack enable pnpm`.

## Next Steps

**Phase D — 안정화 (미착수, 우선순위 높음)**
- Observability: OpenTelemetry + Sentry + 로그 상관관계 ([ADR-017](docs/adr/ADR-017-correlation-id.md) 참조)
- Load / 부하 테스트, 보안 리뷰, 접근성 감사 (WCAG 2.1 AA)
- 통합 / E2E 테스트 스위트
- GitHub Actions CI (lint · test · build · prisma validate)
- Staging 인프라 (ECS + RDS)

**Phase E — 클라이언트**
- CMS (`packages/cms`): Vite + React + shadcn/ui
- Mobile (`packages/mobile`): React Native 0.74
- App Store / Play 심사 준비 (Apple dev program 체크리스트: [`docs/ops/`](docs/ops/))

**남은 백엔드 모듈**
- `notification` 모듈

자세한 로드맵은 [`docs/implementation/a-idol-dev-plan.md`](docs/implementation/a-idol-dev-plan.md) · WBS는 [`docs/implementation/a-idol-wbs.md`](docs/implementation/a-idol-wbs.md)를 참고하세요.
