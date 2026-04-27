# [RPT-260424] Prisma vs TypeORM — 비교 분석 리포트

## Report Metadata (리포트 정보)

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260424 |
| **제목** | Prisma vs TypeORM 비교 분석 |
| **작성일** | 2026-04-24 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 기술 선정 분석 (Technical Decision Analysis) |
| **트리거** | A-idol 코드 컨벤션 편차 — amb-starter-kit(TypeORM) vs A-idol(Prisma) |
| **참조 문서** | [CLAUDE.md §amb-starter-kit 편차표](../../CLAUDE.md), [a-idol-code-convention.md §5.5, §16](../implementation/a-idol-code-convention.md), [docs/amb-starter-kit/amoeba_code_convention_v2.md](../amb-starter-kit/amoeba_code_convention_v2.md) |

---

## Executive Summary (요약)

A-idol은 amb-starter-kit v2.0 표준이 규정한 **TypeORM**이 아닌 **Prisma 5.x**를 ORM으로 채택했다. 본 리포트는 두 ORM의 기술적 특성을 9개 축에서 비교하고, A-idol의 프로젝트 성격(B2C 단일 테넌트, 모바일 우선, 단일 Postgres)에 Prisma 선택이 정당화되는 근거를 정리한다.

**결론**: Prisma 선택은 **합리적이며 유지한다**. 편차 사유는 `a-idol-code-convention.md §16`에 이미 명문화되어 있어 신규 합류자 혼란 요인 낮음.

---

## 1. 포지셔닝 요약 (Positioning Summary)

| 항목 | Prisma | TypeORM |
|---|---|---|
| **출시/버전** | 2018 (현 v5.x, 2024-2025 안정화) | 2016 (현 v0.3.x, 여전히 pre-1.0 표기) |
| **철학** | **Schema-first** — `.prisma` DSL을 단일 진실 원천으로, 타입과 클라이언트를 생성 | **Code-first** — TS 클래스 + 데코레이터를 엔티티로, 런타임 메타데이터 기반 |
| **패턴** | Query Builder + 선언적 객체 쿼리 | Active Record + Data Mapper 양쪽 지원 |
| **런타임** | Rust 기반 query engine 바이너리 + JS 레이어 | 순수 JS/TS (+`reflect-metadata`) |
| **NestJS 통합** | 커스텀 provider (명시 패턴) | 공식 `@nestjs/typeorm` 모듈 |

---

## 2. 핵심 축별 비교 (Dimension-by-Dimension Comparison)

### 2.1 스키마 정의 (Schema Definition)

**Prisma** — 전용 DSL 파일 (`schema.prisma`):

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  nickname  String
  avatarUrl String?  @map("avatar_url")
  createdAt DateTime @default(now()) @map("created_at")
  hearts    Heart[]
  @@map("users")
}
```

**TypeORM** — 데코레이터 기반 TS 클래스:

```typescript
@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid', { name: 'usr_id' })
  usrId: string;

  @Column({ name: 'usr_email', length: 255, unique: true })
  usrEmail: string;

  // ⚠️ nullable + union type → 반드시 type 명시
  @Column({ name: 'usr_avatar_url', type: 'varchar', nullable: true })
  usrAvatarUrl: string | null;

  @CreateDateColumn({ name: 'usr_created_at' })
  usrCreatedAt: Date;

  @OneToMany(() => HeartEntity, (h) => h.user)
  hearts: HeartEntity[];
}
```

| 기준 | Prisma | TypeORM |
|---|---|---|
| 단일 파일 개요 가시성 | ✅ 전체 모델 한 눈에 | ❌ 파일 분산 |
| 코드 vs 스키마 이중화 | ❌ 1개 원천 | ⚠️ class = 스키마 + 코드 |
| 학습 난이도 | DSL 문법 별도 습득 | TS로 친숙 |
| IDE 지원 | Prisma VSCode 확장 (포맷/검증) | TS 네이티브 |

### 2.2 타입 안정성 (Type Safety)

| 시나리오 | Prisma | TypeORM |
|---|---|---|
| 기본 CRUD 결과 타입 | ✅ 완벽 추론 | ⚠️ Entity 클래스 그대로 (부분 select 시 타입 약함) |
| `select`/`include` 조합 시 결과 타입 | ✅ **정밀 추론** (선택한 필드만 포함된 타입) | ❌ Entity 타입 그대로 (실제 로드 필드와 불일치 가능) |
| nullable 필드 타입 반영 | ✅ Prisma Client가 `T \| null` 자동 | ⚠️ `reflect-metadata` 이슈로 수동 명시 필수 |
| Lazy relation 타입 | ✅ Promise 래핑 명시 | ❌ `Promise<T> \| T` 양가적 타입 이슈 빈발 |
| 쿼리 결과 안정성 | 스키마 변경 → 생성 → 타입 오류 즉시 | 스키마 변경 → 런타임에 발견 가능성 |

> amb-starter-kit 컨벤션의 **"nullable 컬럼 `type:` 명시 (MUST)"** 는 순수 TypeORM 이슈. Prisma에서는 `Type?` 문법만으로 해결되어 해당 규칙이 존재하지 않음.

### 2.3 쿼리 API (Query API)

**Prisma** — 선언적 객체 쿼리:

```typescript
const user = await prisma.user.findUnique({
  where: { email: 'demo@a-idol.dev' },
  include: {
    hearts: { where: { createdAt: { gte: since } } },
    fanClubMemberships: { include: { fanClub: true } },
  },
});
// user.hearts 타입이 실제 로드된 필드로 정확히 추론됨
```

**TypeORM** — Repository + QueryBuilder:

```typescript
// Repository API
const user = await userRepo.findOne({
  where: { email: 'demo@a-idol.dev' },
  relations: ['hearts', 'fanClubMemberships', 'fanClubMemberships.fanClub'],
});

// QueryBuilder (복잡 쿼리)
const user = await userRepo.createQueryBuilder('u')
  .leftJoinAndSelect('u.hearts', 'h', 'h.created_at >= :since', { since })
  .leftJoinAndSelect('u.fanClubMemberships', 'm')
  .leftJoinAndSelect('m.fanClub', 'fc')
  .where('u.email = :email', { email })
  .getOne();
```

| 기준 | Prisma | TypeORM |
|---|---|---|
| 단순 CRUD 가독성 | ✅ 간결 | ✅ 간결 (Repository) |
| 복잡 쿼리 | ✅ `include` 중첩 + `where` 세밀 제어 | ⚠️ QueryBuilder 필요 (raw SQL에 근접) |
| N+1 발생 위험 | **낮음** (`include`로 JOIN 자동 생성) | **높음** (lazy relation 남용 시 쉽게 발생) |
| Raw SQL 이스케이프 | `$queryRaw\`…\`` tagged template (주입 방어 기본) | `.query()` — 수동 파라미터 바인딩 |
| 동적 where 조립 | 객체 병합 (타입 안전) | QueryBuilder 체이닝 (타입 약함) |

### 2.4 마이그레이션 (Migration)

| 기준 | Prisma | TypeORM |
|---|---|---|
| CLI | `prisma migrate dev --name xxx` | `typeorm migration:generate -n xxx` |
| 생성 결과물 | **SQL 파일** (`migrations/<ts>_<name>/migration.sql`) | **TS 파일** (up/down 메서드 수동 작성 가능) |
| Diff 정확도 | ✅ 매우 높음 (누락 거의 없음) | ⚠️ 누락/오탐 발생 → 수동 교정 빈번 |
| 순서 관리 | 폴더 타임스탬프 + `_prisma_migrations` 테이블 | TS 파일 + `typeorm_migrations` 테이블 |
| 프로덕션 적용 | `prisma migrate deploy` (idempotent) | `typeorm migration:run` |
| 롤백 지원 | ❌ 공식 지원 없음 (역행 SQL 수동 작성) | ✅ down 메서드 |
| `db:push` 같은 즉시 반영 | ✅ `prisma db push` (로컬 전용) | ⚠️ `synchronize: true` (위험, 스테이징/프로덕션 금지) |
| 스키마 드리프트 감지 | ✅ `migrate status` | ❌ 없음 |

> amb-starter-kit 컨벤션의 "dev는 `synchronize:true`, 스테이징/프로덕션은 수동 SQL"은 **TypeORM 생태계에서만 통용되는 안전 장치**. Prisma는 전 환경에서 동일 마이그레이션 파일 사용이 표준 권장.

### 2.5 관계 매핑 (Relation Mapping)

| 관계 유형 | Prisma | TypeORM |
|---|---|---|
| 1:N | `user.hearts Heart[]` + FK에 `@relation` | `@OneToMany` + `@ManyToOne` 양쪽 |
| N:M (단순) | **명시적 조인 모델** 필요 (예: `Membership`) | `@ManyToMany` + `@JoinTable` 자동 조인 |
| N:M (추가 컬럼 있음) | 명시 조인 모델 (자연스러움) | `@ManyToMany` 불가 → 명시 조인 엔티티 |
| 자기참조 트리 | `parent Unit? @relation("tree")` | `@TreeEntity` + `TreeRepository` (LTree 등) |
| Polymorphic | ❌ 네이티브 지원 없음 (수동 구현) | ⚠️ `@TableInheritance` (STI) |
| Cascade 설정 | `onDelete: Cascade` in `@relation` | `{ cascade: true, onDelete: 'CASCADE' }` |

> **요약**: TypeORM은 N:M을 자동 조인 테이블로 간편 표현, Polymorphic을 네이티브 지원. Prisma는 "모든 관계 = 명시 모델" 강제 → 처음엔 번거롭지만 장기 유지보수 유리.

### 2.6 성능 / 런타임 (Performance / Runtime)

| 기준 | Prisma | TypeORM |
|---|---|---|
| 콜드 스타트 | ⚠️ Rust query engine 프로세스 기동 오버헤드 (~50-200ms) | ✅ 순수 JS, 빠름 |
| 요청당 쿼리 레이턴시 | 경쟁력 있음, 많은 경우 TypeORM보다 빠름 | 가변적, ORM 오버헤드 큼 |
| 대량 레코드 처리 | ✅ `$executeRaw` + 배치, 메모리 효율 좋음 | ⚠️ Entity 인스턴스화 비용 누적 |
| 번들 크기 (serverless) | Client + query engine 바이너리 (~30-50MB) | JS only, 가벼움 |
| Edge runtime | ⚠️ v5부터 Accelerate/Data Proxy 필요 | ❌ Node.js 전용 |
| Connection pool | 내장 (`datasource` 설정) | 수동 설정 (TypeORM + `pg-pool`) |

### 2.7 생태계 / 툴 (Ecosystem / Tooling)

| 도구 / 통합 | Prisma | TypeORM |
|---|---|---|
| GUI DB 브라우저 | ✅ **Prisma Studio** (공식, 무료, 편집 가능) | 외부 도구 사용 (Adminer, DBeaver, etc.) |
| 매니지드 서비스 | Prisma Accelerate, Pulse, Data Platform | 없음 |
| NestJS 공식 모듈 | 없음 (커뮤니티 패턴) | ✅ `@nestjs/typeorm` |
| 문서 품질 | ✅ 우수, 예제 풍부 | ⚠️ 버전별 파편화, 오래된 예제 혼재 |
| 업데이트 속도 | 메이저 출시 활발, breaking change 문서화 양호 | 느림, breaking change 공지 부족 |
| 커뮤니티 활성도 | 높음 (GitHub 39k★) | 중간 (GitHub 33k★, 이슈 정체) |
| 지원 DB | PG, MySQL, SQLite, MSSQL, MongoDB, CockroachDB | 위 + Oracle, SAP HANA, 기타 다수 |

### 2.8 성능 벤치마크 (Benchmarks)

업계에서 자주 인용되는 벤치마크 (2024년 기준, 실제 수치는 쿼리·DB·환경에 따라 큰 편차):

| 벤치마크 축 | Prisma | TypeORM |
|---|---|---|
| 단순 findUnique (핫패스) | ~빠름 | ~빠름, 경쟁력 있음 |
| 복잡 관계 로드 (3-4 depth include) | 안정적, JOIN 최적화 | N+1 빈발 시 악화 |
| Bulk insert 10k rows | `createMany` 매우 빠름 | Entity save 반복 시 느림 |
| 콜드 스타트 | 느림 (query engine) | 빠름 |

> 정확한 비교는 Prisma의 공식 벤치마크 리포나 서드파티 측정(`@benchmarks-js/orm` 류)을 참조해야 하며, **ORM 성능은 N+1 방지·인덱스 설계·연결 풀링 같은 사용 방식에 훨씬 더 의존**함.

---

## 3. 각 ORM이 적합한 프로젝트 (Fit-for-Purpose Matrix)

| 프로젝트 특성 | Prisma | TypeORM |
|---|---|---|
| 새 프로젝트 · 스타트업 | ✅✅ | ⚠️ |
| 타입 안정성이 최우선 | ✅✅ | ❌ |
| 모바일/웹 클라이언트에 타입 공유 필요 | ✅✅ (생성 타입 shared로 재활용) | ⚠️ |
| 복잡한 관계 / 트리 / Polymorphic 구조 | ⚠️ (수동 구현 부담) | ✅ |
| Oracle / SAP HANA 등 특수 DB | ❌ (미지원) | ✅ |
| Edge runtime (Cloudflare Workers, Vercel Edge) | ⚠️ Accelerate 경유 | ❌ |
| 기존 TypeORM 코드베이스 확장 | ❌ | ✅ |
| Active Record 패턴 선호 | ❌ | ✅ |
| 마이그레이션 신뢰성 최우선 | ✅✅ | ⚠️ |
| 대량 bulk insert / 배치 처리 | ✅ (`createMany`, `$executeRaw`) | ⚠️ (Entity 오버헤드) |

---

## 4. A-idol 맥락에서의 Trade-off 분석 (A-idol Context Analysis)

### 4.1 Prisma 선택의 이득 (Benefits for A-idol)

| 이득 | 근거 |
|---|---|
| **`@a-idol/shared` 공유 타입 품질** | Prisma 생성 타입이 정밀 → Response DTO 계약도 타이트하게 유지 |
| **마이그레이션 신뢰성** | 32개 모델, Phase A~C 걸쳐 누적 스키마 변경 있었을 것 — diff 오탐/누락 위험 낮음 |
| **Prisma Studio** | 기획자/CS가 `adminer` 대신 Studio로 데이터 관찰 가능 (직관적) |
| **모바일팀과의 계약** | React Native 팀이 `UserDto`/`IdolCardDto` 등 공유 타입을 그대로 소비 |
| **간결한 도메인** | 팬덤 B2C는 복잡 polymorphic/tree 구조 거의 없음 → Prisma의 명시 모델 제약이 비용 안 됨 |
| **Clean Architecture 궁합** | Prisma Client를 `infrastructure/`에 가둠 → 도메인 순수성 유지 쉬움 |

### 4.2 Prisma 선택의 비용 (Costs Incurred)

| 비용 | 대응 |
|---|---|
| **NestJS 공식 모듈 부재** | A-idol은 `packages/backend/src/shared/prisma/` 커스텀 provider 패턴으로 해결 |
| **N:M 조인 모델 수동 관리** | 예: `Membership`, `UserPhotocard` — 이미 도메인상 의미있는 엔티티라 자연스러움 |
| **복잡한 동적 쿼리** | `QueryBuilder` 없음 → 필요 시 `$queryRaw` 사용 (A-idol 투표 집계 등은 Redis 리더보드로 회피: [ADR-014](../adr/ADR-014-leaderboard-redis-pg-snapshot.md)) |
| **Edge 배포 불가** | 현재 ECS 배포 계획이라 영향 없음 |

### 4.3 amb-starter-kit과의 관계 (Relationship with amb-starter-kit)

amb-starter-kit이 TypeORM 표준을 유지하는 이유 (추정):

- **AMB Management 프로젝트 베스트 프랙티스** 누적 (OwnEntityGuard 등 멀티테넌시 장치가 TypeORM subscriber/Repository 훅에 의존)
- **복잡한 B2B 도메인** — 법인/부서/역할 계층, polymorphic 권한 구조
- **Oracle 등 엔터프라이즈 DB 지원** 필요 가능성

A-idol이 Prisma로 이탈한 것은 **프로젝트 성격 차이에 근거한 합리적 선택**:

- B2C 단일 테넌트 → OwnEntityGuard 불필요
- 모바일 앱 우선 → 타입 공유 품질이 더 중요
- Postgres 단일 타겟 → TypeORM의 다중 DB 지원 이점 무효
- 새 코드베이스 → 기존 TypeORM 자산 없음

---

## 5. 결론 및 권고 (Conclusion & Recommendations)

### 5.1 결론 (Conclusion)

| 질문 | 답 |
|---|---|
| **Prisma 선택이 옳았는가?** | ✅ A-idol의 프로젝트 성격(B2C 단일 테넌트, 모바일 우선, Postgres 전용, 새 코드베이스)에 **잘 맞음** |
| **amb-starter-kit을 따르지 않은 비용은?** | 낮음 — 컨벤션 문서([a-idol-code-convention.md](../implementation/a-idol-code-convention.md) §5.5, §16)에 편차 이유가 명문화되어 있어 신규 합류자 혼란 최소화 |
| **되돌릴 필요가 있는가?** | ❌ 현재 **코드베이스 전반이 Prisma에 의존** (32개 모델, 시드, 마이그레이션 히스토리, shared 타입). 전환 비용 > 이득 |

### 5.2 향후 주의사항 (Forward-Looking Risks)

1. **Edge 배포 검토 시점에 재평가** — Cloudflare Workers / Vercel Edge 전환이 필요해지면 Prisma Accelerate 또는 Data Proxy 비용 발생. 현재 ECS 배포 계획 유지 시 영향 없음.
2. **복잡 집계 쿼리 전략** — QueryBuilder 없으므로 `$queryRaw` 또는 Redis 캐싱으로 우회 ([ADR-014 리더보드 패턴](../adr/ADR-014-leaderboard-redis-pg-snapshot.md) 유지).
3. **메이저 버전 업그레이드** — Prisma v5→v6 전환 시 breaking change 리뷰. `@prisma/client`와 `prisma` CLI 동일 버전 유지 필수.
4. **N+1 감시** — `include` 남용으로 무거운 JOIN이 발생할 수 있음. 주요 엔드포인트에 대해 실제 쿼리 플랜(EXPLAIN) 점검 권장 (Phase D 관측 도입 시).
5. **커스텀 provider 문서화** — `@nestjs/typeorm` 같은 공식 모듈이 없으므로, A-idol의 Prisma NestJS 통합 패턴(`PrismaService`, 모듈 등록, 트랜잭션 경계)을 ADR로 명문화 검토.

### 5.3 의사결정 기록 (ADR-020)

본 리포트의 결론에 근거해 ADR을 작성·커밋했다:

- **ADR ID**: [ADR-020 — Adopt Prisma as the ORM (deviating from amb-starter-kit's TypeORM standard)](../adr/ADR-020-orm-prisma-over-typeorm.md)
- **상태**: Accepted (retroactive, 2026-04-24)
- **내용**: A-idol이 amb-starter-kit 표준(TypeORM)을 이탈해 Prisma 5.x를 채택한 사유 명문화, 대안 검토 (TypeORM / Drizzle / 원시 SQL / MikroORM), 구현 현황 및 Phase D 후속 작업 정리

---

## Appendix A — Document History (문서 이력)

| Version | Date | Author | Changes |
|---|---|---|---|
| v1.0 | 2026-04-24 | Gray Kim | 초기 작성 — Prisma vs TypeORM 9개 축 비교 + A-idol 맥락 분석 + ADR 작성 권고 |
