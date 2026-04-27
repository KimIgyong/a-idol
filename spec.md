# A-idol 개발 환경 및 구조 명세서

## 📋 프로젝트 개요

- **프로젝트명**: A-idol (AI Idol Fandom Platform)
- **개발 단계**: MVP Setup 단계 (Phase 0/A 부분 완료)
- **GA 목표일**: 2026-08-01
- **아키텍처**: Clean Architecture (Entity → UseCase → Interface Adapter → Infrastructure)

## 🏗️ 프로젝트 구조

### 모노레포 구성
```
a-idol/
├── packages/
│   ├── backend/          ✅ NestJS + Prisma + PostgreSQL + Redis
│   ├── shared/           ✅ 공통 도메인 엔티티 + DTO 계약
│   ├── mobile/           📋 React Native (스캐폴딩만 완료)
│   └── cms/              📋 React CMS (미구현, T-006 예정)
├── docs/                 📚 SDLC 아티팩트 + 참조 규약
├── sql/                  🗄️ Full-DDL 참조
├── docker-compose.yml    🐳 postgres + redis + adminer
└── Makefile             🔧 개발 명령어
```

### Backend 모듈 구성 (Clean Architecture)
```
packages/backend/src/modules/
├── identity/             ✅ 회원가입/로그인/OAuth
├── catalog/              ✅ 아이돌/에이전시/스케줄/이미지
├── fandom/               ✅ 하트/팔로우/팬클럽/멤버십
├── chat/                 ✅ 채팅방/메시지/쿠폰/WebSocket
├── commerce/             ✅ 상품/구매/IAP 검증
├── audition/             ✅ 오디션/라운드/엔트리/투표규칙
├── vote/                 ✅ 투표/리더보드/랭킹 스냅샷
├── photocard/            ✅ 포토카드/가챠/컬렉션
├── admin-ops/            ✅ CMS 인증 + 분석 대시보드
└── health/               ✅ 헬스체크 (라우팅 이슈 있음)
```

## 🌐 서버 및 포트 정보

### 로컬 개발 환경
| 서비스 | 포트 | URL | 상태 |
|--------|------|-----|------|
| **NestJS Backend** | 3000 | http://localhost:3000 | ✅ 실행 중 |
| **Swagger API Docs** | 3000 | http://localhost:3000/docs | ✅ 사용 가능 |
| **PostgreSQL** | 5433 | localhost:5433 | ✅ 실행 중 |
| **Redis** | 6379 | localhost:6379 | ✅ 실행 중 |
| **Adminer** | 8080 | http://localhost:8080 | ✅ 사용 가능 |
| **Prisma Studio** | 5555 | make studio → http://localhost:5555 | 📋 요청 시 실행 |

### CORS 설정
```env
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,http://localhost:8081
```

## 🗄️ 데이터베이스 정보

### PostgreSQL 연결 정보
```env
HOST: localhost
PORT: 5433
DATABASE: aidol
USER: aidol  
PASSWORD: aidol_dev
CONNECTION_URL: postgresql://aidol:aidol_dev@localhost:5433/aidol?schema=public
```

### Adminer 접속 정보
- URL: http://localhost:8080
- 서버: postgres  
- 사용자: aidol
- 비밀번호: aidol_dev
- 데이터베이스: aidol

### 시드 데이터 현황
```
✅ seeded: 4 idols, 3 fan clubs
- Agency: A-idol Agency (00000000-0000-0000-0000-000000000001)
- Idols: Aria, Bina, Caleb + Lee Hyun-woo (HYUN)
```

## 🔗 API 엔드포인트 구성

### 인증 (Identity)
| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/1/auth/signup` | 회원가입 (이메일) |
| POST | `/1/auth/login` | 로그인 |  
| POST | `/1/auth/refresh` | 토큰 갱신 |
| GET | `/1/me` | 내 정보 조회 |

### 카탈로그 (Catalog)
| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/1/idols` | 아이돌 목록 조회 |
| GET | `/1/idols/{id}` | 아이돌 상세 조회 |

### 헬스체크
| Method | Endpoint | 설명 | 상태 |
|--------|----------|------|------|
| GET | `/health` | 서버 상태 확인 | ⚠️ 라우팅 이슈 |

## 🛠️ 개발 명령어

### 기본 개발 흐름
```bash
# 전체 부트스트랩 (최초 1회)
make bootstrap

# 개발 서버 시작
make dev

# 일반적인 작업
make migrate    # 마이그레이션 실행
make seed      # 시드 데이터 생성  
make test      # 유닛 테스트
make studio    # Prisma Studio 열기
make smoke     # E2E 스모크 테스트
```

### 상세 명령어
```bash
pnpm install           # 의존성 설치
pnpm db:up            # Docker PostgreSQL/Redis 시작
pnpm db:down          # Docker 컨테이너 중지
pnpm migrate          # Prisma 마이그레이션
pnpm seed             # 시드 데이터 생성
pnpm dev              # 백엔드 개발 서버 (watch 모드)
pnpm typecheck        # TypeScript 검사
pnpm lint             # ESLint 검사
```

## 🔧 환경 변수

### 주요 설정 (.env)
```env
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# DB 연결
DATABASE_URL=postgresql://aidol:aidol_dev@localhost:5433/aidol?schema=public
REDIS_URL=redis://localhost:6379/0

# JWT 토큰
JWT_ACCESS_SECRET=change-me-access-secret-0123456789abcdef
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change-me-refresh-secret-0123456789abcdef  
JWT_REFRESH_EXPIRES_IN=14d

# 보안
BCRYPT_ROUNDS=10

# OAuth (Phase 2 예정)
KAKAO_CLIENT_ID=
APPLE_CLIENT_ID=
GOOGLE_CLIENT_ID=
```

## 📚 기술 스택

### Backend
- **Framework**: NestJS v10.3.10
- **ORM**: Prisma v5.22.0  
- **Database**: PostgreSQL 16 + Redis 7
- **Authentication**: JWT
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI
- **Logging**: Pino

### Frontend (예정)
- **Mobile**: React Native (packages/mobile - 스캐폴딩만)
- **CMS**: Vite + React (packages/cms - 미구현, T-006 태스크)

### DevOps
- **Container**: Docker Compose
- **Package Manager**: pnpm v9.12.0
- **Node**: >=20.10

## 🔄 개발 단계 현황

### ✅ 완료됨 (Phase 0/A/B/C 약 65-70%)
- Backend 10개 모듈 구현 완료
- API 엔드포인트 6개 동작 확인
- 데이터베이스 스키마 + 마이그레이션
- 시드 데이터 + Docker 환경 구성

### 📋 진행 예정
- **Phase D**: 관찰가능성, 보안 검토, 로드 테스트, 접근성
- **T-006**: CMS (Vite/React) 스캐폴딩 + 인증 쉘 (2일)
- **Mobile App**: React Native 구현

### ⚠️ 알려진 이슈
- `/health` 엔드포인트 404 응답 (NestJS 버전별 라우팅 설정 이슈로 추정)
- 다른 모든 API는 정상 동작

## 📖 문서 참조

### 프로젝트 문서
- **CLAUDE.md**: 프로젝트 컨텍스트 + 규약 요약
- **docs/design/**: 요구사항 정의 + 아키텍처 + ERD + 시퀀스
- **docs/adr/**: 아키텍처 결정 기록 (ADR-010~020)
- **docs/implementation/**: WBS + 개발 계획 + 코드 규약

### API 문서
- **Swagger UI**: http://localhost:3000/docs
- **API JSON**: http://localhost:3000/docs-json

---

**마지막 업데이트**: 2026-04-27  
**개발 환경**: 로컬 개발 서버 정상 실행 중