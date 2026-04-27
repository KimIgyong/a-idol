# 설계 스케치 — `/leaderboard` 전체 응답 Redis 캐시

> **Status**: 설계만 · 미구현. 구현 트리거는 k6 50k-concurrent 실측에서
> `/leaderboard` 가 여전히 병목일 때. ADR-021 Phase D 백로그 마지막 항목.
>
> Owner: Gray Kim · Draft: 2026-04-24

---

## 왜 지금 설계만?

현재 `/leaderboard`는 이미 2개 레버 적용됨:
- Lever 3 `IdolMetaCache` → idol name hydrate MGET (localhost 기준 +26% RPS)
- Lever 2 Prisma `select` narrowing은 leaderboard 경로엔 해당 없음

로컬 측정 6,454 RPS / p50 7 ms 수준이라 추가 캐시 이득이 얼마일지
모호함. **staging pm2 cluster + managed PG/Redis + 50k VUs k6 결과**가
있어야만 이 캐시의 ROI 판단 가능. 조기 구현 시:
- 캐시 일관성 버그 (vote cast vs cache stale) 리스크
- `IdolMetaCache`와 중복 저장 (메모리 낭비)
- invalidation 훅 추가 (CastHeartVoteUseCase / CastTicketVoteUseCase)

→ 측정 먼저, 구현은 버튼. 대신 설계를 고정해 **구현 PR은 1일 내 작성
가능**하도록 프리셋.

---

## 설계

### Redis key schema

```
leaderboard:{roundId}:v1    → JSON (stringified LeaderboardView)
```

- 버전 suffix `v1` — 앞으로 `LeaderboardView` 계약이 바뀌면 `v2` 도입해서
  점진적 마이그레이션. 구버전 key는 TTL로 자연 만료.
- `roundId` 외의 필터(limit 등) 는 key 분리 필요 여부를 측정 후 결정.
  MVP: `limit=50` 하나만 캐싱.

### TTL 정책

- **Primary**: `EX 5` (5 seconds). 실시간 투표 tickers는 5초 지연을 감지
  못 하는 수준의 UX. 트래픽 spike 시 5초 버스트 → 1 DB 쿼리로 변환.
- **Secondary (vote cast 시)**: invalidation 훅 — `DEL leaderboard:{roundId}:v1`
  을 `CastHeartVoteUseCase` / `CastTicketVoteUseCase` 성공 후 호출.
  훅 실패는 swallow (TTL이 백업).

### Invalidation 훅 위치

```typescript
// CastHeartVoteUseCase.execute, ZINCRBY 성공 후 (ADR-014)
await this.cache.invalidate(roundId);

// CastTicketVoteUseCase.execute, 같은 지점
await this.cache.invalidate(roundId);
```

`RoundClosedListener`도 훅 걸기 — 라운드 종료 시 snapshot 찍히고
leaderboard 의미 변함 → cache 즉시 drop.

### 포트 신설

```typescript
// packages/backend/src/modules/vote/application/interfaces.ts
export interface LeaderboardCache {
  get(roundId: string): Promise<LeaderboardView | null>;
  set(roundId: string, view: LeaderboardView): Promise<void>;
  invalidate(roundId: string): Promise<void>;
}

export const LEADERBOARD_CACHE = 'LeaderboardCache';
```

- Impl: `RedisLeaderboardCache` — SET `EX 5`, JSON 직렬화.
- Null-object fallback (Redis 장애 시) — interface만 잡고 get() 항상
  null 반환 → 정상 DB 경로 fallback.

### GetLeaderboardUseCase 통합

```typescript
async execute(roundId: string, limit = 50): Promise<LeaderboardView> {
  const cached = await this.cache.get(roundId);
  if (cached) return cached;

  const round = await this.rounds.findById(roundId);
  if (!round) throw new DomainError(ErrorCodes.ROUND_NOT_FOUND, '...');

  const top = await this.counters.topForRound(roundId, limit);
  if (top.length === 0) {
    const empty = { roundId, status: round.status, entries: [] };
    await this.cache.set(roundId, empty);  // 빈 결과도 캐시 (thundering herd 방어)
    return empty;
  }

  const byId = await this.idolMeta.getMany(top.map((t) => t.idolId));
  const view: LeaderboardView = {
    roundId,
    status: round.status,
    entries: top.map((t, idx) => ({ ... })),
  };
  await this.cache.set(roundId, view);
  return view;
}
```

### IdolMetaCache와의 관계

두 캐시는 **직교적 용도**:
- `IdolMetaCache`: idol name/stageName/heroImageUrl (churn 낮음, 5분 TTL,
  write-through invalidation)
- `LeaderboardCache`: 투표 점수 + 전체 ranked 엔트리 (churn 높음, 5초 TTL,
  vote cast 시 invalidation)

cache miss 시 `IdolMetaCache.getMany` 는 여전히 호출됨 — 중복 아님.

---

## 예상 임팩트 (추정)

| 시나리오 | Baseline (cache miss 경로) | With full cache (hit) | 예상 Δ |
|---|---|---|---|
| `/leaderboard` warm (localhost) | 6,454 RPS · p50 7 ms | ~9k+ RPS · p50 <3 ms | +40% |
| 동일 엔드포인트, 50k VU staging | ? (k6로 측정) | Redis GET only | 10x+ 추정 |

localhost는 Prisma + Redis 모두 <1 ms라 이득 작음. 운영 환경에선 PG 커넥션
풀 포화 / VACUUM / replica lag 영향이 사라지는 게 훨씬 큼.

---

## 리스크 + 완화

| 리스크 | 완화 |
|---|---|
| 5초 stale — 투표 직후 내 점수 안 보임 | invalidation 훅으로 자기 투표는 즉시 반영. TTL은 타인 투표용 |
| Redis 장애 → 전체 /leaderboard 실패 | null-object cache impl → DB 경로 자동 fallback |
| JSON payload 크기 증가 (Redis 메모리) | `limit=50` 상한 + round별 키 하나. 1k 활성 라운드 × 10 KB ≒ 10 MB (무시 가능) |
| thundering herd on cache expiry | 빈 결과도 캐시 + 5s TTL = 동시 miss 윈도우 짧음. 필요 시 SETNX lock 추가 |
| vote cast hot path에 Redis DEL 추가 | DEL 은 O(1), 실패 swallow — hot path 영향 <1% |

---

## 구현 체크리스트 (k6 50k 실측 후 착수)

- [ ] `LeaderboardCache` 포트 + `RedisLeaderboardCache` impl 추가
- [ ] `RedisLeaderboardCache` unit spec (get/set/invalidate, TTL 검증)
- [ ] `VoteModule` DI 등록 + `GetLeaderboardUseCase` 에 주입
- [ ] `CastHeartVoteUseCase` / `CastTicketVoteUseCase` / `RoundClosedListener`
  에 invalidate 훅 + try/catch swallow
- [ ] Integration test: vote cast 직후 leaderboard 재조회 시 fresh 데이터
- [ ] Integration test: 5s TTL 경과 시 DB miss path 복귀
- [ ] Integration test: Redis 연결 끊긴 상태에서도 /leaderboard 200
- [ ] `docs/ops/perf-baseline-ko.md` 측정값 추가, ADR-021 백로그 항목 마감
- [ ] k6 `mixed-read.js`의 p(95) leaderboard threshold 재설정

---

## 참고

- ADR-014 (leaderboard Redis + PG snapshot) — 이 캐시는 ZSET 위에 **읽기
  뷰 캐시**를 추가하는 것. ZSET 자체는 변화 없음.
- ADR-021 (Phase C 성능 레버 4축) — 이 캐시가 Lever 5가 될지는 측정 후
  판단. 현재 백로그에만 등록.
- [perf-baseline-ko.md](perf-baseline-ko.md) 측정 방법 섹션 — k6 실측 이후
  RPS/p95 전후 비교 기록 위치.
