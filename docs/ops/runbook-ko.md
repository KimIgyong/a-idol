# A-idol Go-live Runbook

> GA 이후 운영 담당(첫 6개월은 Gray Kim 1인)이 장애 · 이상 · 법적 이벤트
> 발생 시 참고하는 플레이북. 이 문서에 없는 상황이 터지면
> **(1) 조치** → **(2) 배운 것을 이 문서에 반영** 순서로 해결한다.
>
> Owner: Gray Kim · Last updated: 2026-04-23 · Status: **Draft** (GA 전 회람 필요)

---

## 0. 시작하기 전에

**이 문서는 GA 전** 최소 1회 PO·CTO 회람 + 분기마다 갱신. 운영자가 바뀌면
새 담당이 전체를 훑고 실제와 틀린 부분을 수정해야 유효. 문서 신선도가
유효성을 결정함.

**첫 원칙**: 고객 영향 → 데이터 안전 → 가시성 → 속도 순. 빠른 응답이
정확한 응답보다 낫다는 유혹에 빠지지 말 것.

---

## 1. 서비스 개요 (운영자 기준)

### 1.1 토폴로지

```
[iOS/Android App]──┐
                   │     HTTPS
[Web CMS]──────────┼──▶ [Backend NestJS (port 3000)]
                   │        │
                   │        ├── Postgres 16 (primary)
                   │        ├── Redis 7 (leaderboard + BullMQ + rate)
                   │        ├── BullMQ workers (in-process)
                   │        │    ├── ranking-snapshot (5분 주기)
                   │        │    ├── leaderboard-audit (매시 + 부팅 즉시)
                   │        │    ├── chat-quota-reset (KST 자정)
                   │        │    └── auto-message (delayed)
                   │        └── Static /api/uploads (SVG/이미지)
                   │
                   └─ S2S webhooks (Apple IAP 등, 미출시)
```

### 1.2 핵심 엔드포인트 (장애 판정용)

| 엔드포인트 | 기대 응답 | 신호 |
|---|---|---|
| `GET /health` | `{status: 'ok', db: 'up', redis: 'up'}` | 전체 up/down 기준 |
| `GET /api/v1/idols?size=1` | 200 + items[] | 읽기 경로 살아있음 |
| `POST /api/v1/auth/login` (dev 계정) | 200 + accessToken | 인증 경로 |
| `POST /api/v1/commerce/purchases` (DEV_SANDBOX) | 200 + FULFILLED | 결제 chain + fulfiller |

5분 내 이 4개 중 **하나라도** 500 / 5초 이상 지연 시 **Sev-2** 이상 인지 판정.

### 1.3 로그 조회

전 백엔드 로그는 `nestjs-pino` 구조화 JSON. 모든 라인에 `reqId`(UUID)가
있어 유저 지원 요청에 포함된 요청 ID로 **원샷 grep 가능**.

```bash
# 예: 유저가 "요청 ID: 9a86…202804" 보내옴
kubectl logs deploy/aidol-backend | grep '"reqId":"9a862408-'
# 또는 로그 집계기(Sentry/Datadog) 붙은 후에는 해당 필드로 검색
```

ADR-017 참조. 모바일/CMS 클라이언트도 `X-Request-ID`를 echo 받아 UI에
노출하므로 유저 스크린샷에 id가 찍혀 있음.

### 1.4 메트릭 (Prometheus)

`GET /metrics` (port 3000) — `text/plain; version=0.0.4` exposition. 모든
주요 스크래이퍼 호환 (Prometheus, Datadog Agent `prometheus_check`, Grafana
Cloud Agent, VictoriaMetrics).

**노출 메트릭** (라벨: `service=a-idol-backend`):

| 메트릭 | 타입 | 라벨 | 용도 |
|---|---|---|---|
| `http_requests_total` | counter | `method`, `route`, `status_class` (2xx/4xx/5xx) | RED — Rate · Errors |
| `http_request_duration_seconds` | histogram (13 buckets, 5ms~30s) | 동일 | RED — Duration (p50/p95/p99) |
| `http_server_errors_total` | counter | `method`, `route` | 5xx 알람 트리거용 (분리) |
| `auth_login_failures_total` | counter | `kind` (user/admin) | T-082 — credential stuffing 패턴 모니터링 |
| `auth_account_locked_total` | counter | `kind` (user/admin) | T-082 — lockout 발동 카운터 (NIST §5.2.2) |
| `process_*`, `nodejs_*` | gauge/counter | (default) | 메모리 · GC · event-loop lag · FD |

**라벨 카디널리티**: `route`는 Express matcher의 패턴 (`/idols/:id`) 사용 — UUID
폭발 차단. 미매칭(404)은 `unknown` 으로 묶음. `/health` 와 `/metrics` 자체는
self-exclude (스크래이프/probe 트래픽 카운터 오염 방지).

**스크래이프 ACL** (운영 필수):

`/metrics` 자체에 인증 없음. **반드시 ingress 레벨에서 차단**:

- **K8s + nginx-ingress**: 별도 internal-only Service + NetworkPolicy로 VPC
  내부 Prometheus만 접근.
- **AWS ALB**: target group 분리 + security group 으로 Prom 인스턴스 IP만 허용.
- **Cloudflare**: WAF rule 로 외부 차단 (`/metrics` path → block).
- 임시: nginx basic-auth (`auth_basic_user_file`) — staging 동안.

외부 노출되면 **process metrics에서 PID/FD/메모리 정보 + 트래픽 패턴 leak**.
Datadog Agent 사용 시에도 endpoint URL은 internal IP/hostname으로 설정.

**권장 알람** (Prometheus alertmanager 또는 Datadog 모니터):

```yaml
# 5xx burst — 1분 내 5xx 누적 5건 이상
- alert: A-idol-Backend-5xx-Burst
  expr: increase(http_server_errors_total{service="a-idol-backend"}[1m]) > 5
  for: 0s
  severity: Sev-2

# 본 운영 SLO — p95 latency < 300ms (perf-baseline-ko.md)
- alert: A-idol-Backend-p95-Latency
  expr: |
    histogram_quantile(0.95,
      sum by (le) (rate(http_request_duration_seconds_bucket{service="a-idol-backend"}[5m]))
    ) > 0.3
  for: 5m
  severity: Sev-3

# event-loop lag — Node 프로세스 saturated 신호
- alert: A-idol-Backend-Event-Loop-Lag
  expr: nodejs_eventloop_lag_p99_seconds{service="a-idol-backend"} > 0.1
  for: 2m
  severity: Sev-3

# T-082 보안 — 로그인 실패 burst (credential stuffing 의심)
- alert: A-idol-Login-Failure-Burst
  expr: increase(auth_login_failures_total{service="a-idol-backend"}[5m]) > 50
  for: 0s
  severity: Sev-2

# T-082 보안 — admin lockout 트립 (실제 brute-force 또는 DoS-by-lockout)
- alert: A-idol-Admin-Account-Locked
  expr: increase(auth_account_locked_total{service="a-idol-backend",kind="admin"}[10m]) > 0
  for: 0s
  severity: Sev-2
```

### 1.5 보안 헤더 (helmet) + Rate-limit

**helmet default 헤더** (T-082, main.ts에서 적용):

| 헤더 | 값 | 목적 |
|---|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | HTTPS 강제 (1년) |
| `X-Content-Type-Options` | `nosniff` | MIME sniff 차단 |
| `X-Frame-Options` | `SAMEORIGIN` | clickjacking 차단 |
| `Referrer-Policy` | `no-referrer` | URL leak 방지 |
| `Cross-Origin-Opener/Resource-Policy` | `same-origin` | spectre 완화 |
| `Origin-Agent-Cluster` | `?1` | 프로세스 격리 힌트 |
| `X-Powered-By` | (제거) | fingerprint 표면 축소 |
| `Content-Security-Policy` | (아래 표 참조) | XSS / 외부 자원 주입 차단 |

**Content-Security-Policy directives** (2026-04-27 enable):

| Directive | 값 | 의도 |
|---|---|---|
| `default-src` | `'self'` | 명시 안 된 자원은 same-origin만 |
| `script-src` | `'self' 'unsafe-inline'` | Swagger UI 인라인 스크립트 허용. 외부 script-src 차단 유효 (XSS 외부 주입 방어) |
| `style-src` | `'self' 'unsafe-inline'` | Swagger UI 인라인 스타일 |
| `img-src` | `'self' data: https:` | favicon (data URI) + 향후 외부 이미지 |
| `font-src` | `'self' data:` | data URI 폰트 (Pretendard subset 등 fallback) |
| `connect-src` | `'self'` | Swagger UI fetch (`/docs-json`) |
| `frame-ancestors` | `'self'` | clickjacking — same-origin 만 embed |
| `object-src` | `'none'` | Flash/legacy 차단 |
| `base-uri` | `'self'` | base href 조작 차단 |
| `form-action` | `'self'` | form 외부 submit 차단 |
| `upgrade-insecure-requests` | `(set)` | HTTP → HTTPS 자동 |

**JSON 응답에 CSP는 무해** — 브라우저가 렌더링 안 함. CSP 강화는 `/docs`
HTML 응답이 주 보호 대상.

**알려진 한계**: `'unsafe-inline'` 은 XSS 인라인 주입 방어가 약함.
Swagger UI 가 nonce / hash 기반 inline 으로 마이그레이션 되거나 별도 도메인
으로 분리되면 strict CSP 가능.

**글로벌 rate-limit** (`@nestjs/throttler` 글로벌 ThrottlerGuard):

| 스코프 | 한도 | 적용 라우트 |
|---|---|---|
| Default | **200 req / 60s / IP** | 전체 |
| Admin login | 10 req / 60s / IP | `POST /api/v1/admin/auth/login` (brute-force 차단) |
| Vote cast | 30 req / 60s / IP | `POST /api/v1/rounds/:id/votes` (`@Throttle` override) |
| Skip | (무한) | `/health`, `/metrics` (`@SkipThrottle`) |
| **Account lockout** | 10회 fail / 15min / email | `POST /api/v1/auth/login` + `POST /api/v1/admin/auth/login` (Redis counter, NIST §5.2.2). IP throttle 와 별도 layer — credential stuffing(IP rotate) 방어 |

응답 헤더로 `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
echo. 초과 시 **429 Too Many Requests**. K8s liveness probe + Prom scrape 트래픽은
영향 없음 (skip).

**튜닝 시점**: GA 후 첫 1주 모니터링하여 정상 모바일 사용자 P99 트래픽 패턴
파악 → 200/min이 부족하면 상향. 단순 trigger의 abusive bot은 200/min에서도
충분히 trip.

**환경별 override** (`THROTTLE_LIMIT_PER_MINUTE` env):

```bash
# k6 staging 부하 측정 윈도우 — staging only
THROTTLE_LIMIT_PER_MINUTE=100000 pnpm dev

# 절대 production에 적용하지 말 것 — abusive bot 차단 무력화.
# 측정 끝나면 default(200)로 복귀 + helm/secrets 에 흔적 안 남기기.
```

GA prod에서는 200(default) 유지. ttl(60s)은 hardcoded — 변경하려면 별도
ADR (window semantics 자체를 바꾸는 일).

---

## 2. 에스컬레이션 체인

### 2.1 심각도 등급

| Sev | 정의 | 예 | 즉시 조치 |
|---|---|---|---|
| **Sev-1** | 전체 중단 · 금전 손실 · 데이터 유실 | /health 5분+ down, DB 쓰기 실패, 중복 청구 | 즉시 PO + CTO 호출, 상태페이지 업데이트 |
| **Sev-2** | 주요 기능 중단 (투표·결제·채팅 중 하나) | 투표 leaderboard 빈 응답, IAP webhook 미도착, 채팅 WS disconnect 폭증 | 30분 내 PO 통지 + 처치 착수 |
| **Sev-3** | 일부 UX 저하 (복구 가능 오류) | 에러율 1~5% 상승, 큐 백로그, p99 지연 | 당일 조치, 지원 채널 모니터링 |
| **Sev-4** | 단일 유저 이슈 | 한 명의 환불 요청, 개별 계정 이상 | 지원팀 표준 대응 (FAQ) |

### 2.2 호출 순서

1. **당직(Gray Kim)** — GA 후 6개월은 단독. 다른 엔지니어 합류 시 on-call 로테이션 ADR 추가.
2. **PO 에스컬레이션**: Sev-1/2 발생 직후, 회복 불명확 시.
3. **법무 에스컬레이션**: (a) 금전 손실 발생 (b) 규제 질의·언론 문의 도착 (c) 개인정보 침해 의심.
4. **외부 벤더**: Apple IAP / Google Play / (나중에) Stripe · AWS.

### 2.3 커뮤니케이션 채널

현재 내부 채널 미정. GA 전 `#incident-live`(실시간) + `#incident-post`(복기) Slack 채널 생성 필요. 운영자 1인 체제 동안에는 **PO 1:1 DM**으로 대체.

---

## 3. Rollback 절차

### 3.1 백엔드 코드 rollback

**전제**: 각 릴리스에 git tag + docker image tag가 1:1로 대응한다 (`v1.2.3` → `ghcr.io/amoeba-group/aidol-backend:v1.2.3`).

```bash
# 1. 현재 돌아가는 이미지 확인
kubectl describe deploy aidol-backend | grep Image:

# 2. 직전 stable 태그로 롤백
kubectl set image deploy/aidol-backend backend=ghcr.io/amoeba-group/aidol-backend:v<PREV>

# 3. 롤아웃 확인
kubectl rollout status deploy/aidol-backend --timeout=3m

# 4. /health 정상 확인
curl -fsS https://api.a-idol.app/health | jq .
```

**ECS 인프라 아직 미구축 (T-008 Phase D)** — 현 단계에선 로컬 docker-compose
기준 `git checkout <prev-tag> && make bootstrap`.

### 3.2 Prisma 마이그레이션 rollback

**절대 원칙**: Prisma는 down-migration을 자동 생성하지 **않음**. Forward-
only migration 정책이며, rollback은 **데이터 손실 없는 reverse DDL 수동 작성**으로만 진행.

프로덕션 rollback이 필요한 경우:

1. 변경된 컬럼 / 테이블 파악 (`ls packages/backend/prisma/migrations/` + 최신 timestamped 폴더).
2. 데이터 백업 스냅샷 확인 (RDS point-in-time recovery, 최소 7일 보관).
3. reverse DDL 작성 → 수동 `psql` 실행.
4. `_prisma_migrations` 테이블에서 해당 row 삭제.
5. 백엔드 이미지도 동일하게 이전 버전으로 rollback.

**예외**: column add (non-null default 있음) / index add 등 순수 적재형 변경은 **롤백 불필요** — forward로 다시 add / drop하면 됨.

### 3.3 모바일 앱

- **Expo/RN**: 앱 스토어 등록 후 rollback은 사실상 불가 (Apple이 거부하지 않는 한 이전 버전 재제출). **서버 사이드 킬 스위치** 접근이 현실적 — 특정 feature flag로 기능 off + 공지.
- **OTA**: EAS Update 사용 시 이전 update revert 가능. MVP는 OTA 미도입, 정식 빌드만.

### 3.4 CMS

Vercel / Netlify 등 host에서 이전 deploy로 rollback 버튼 1클릭. 배포 ID 기록 필수.

---

## 4. 흔한 incident 유형별 플레이북

### 4.1 Redis leaderboard flush (Sev-2)

**증상**: `/api/v1/rounds/:id/leaderboard`가 빈 entries 반환하면서 ACTIVE 라운드 투표는 여전히 들어옴.

**1차 대응**:

1. `GET /health`에서 `redis: 'up'` 확인 — 연결은 살아있는지.
2. 백엔드 로그에서 "ZSET empty with votes present" WARN 검색 — 부팅 warmup이 이미 복구 시도했을 가능성.
3. 그래도 비어 있으면 **수동 reconcile** (admin 토큰 필요):
   ```bash
   curl -X POST https://api.a-idol.app/api/v1/admin/rounds/<ROUND_ID>/reconcile-leaderboard \
     -H "Authorization: Bearer $ADMIN_TOKEN"
   ```
   응답 `{sourceRows, entriesWritten, totalScore, completedAt}` 확인.
4. Leaderboard 정상 복구되면 Sev 해제. 원인 조사 (Redis OOM? AOF 손실? 배포 시 캐시 미warmup?)는 post-mortem.

**ADR 참조**: ADR-014. 복구 메커니즘은 구현 완료.

### 4.2 IAP webhook 미도착 / 검증 실패 (Sev-2, IAP 출시 후)

**증상**: 유저가 결제했는데 `purchase_transactions.status = PENDING` 상태로 남음.

**1차 대응**:

1. Apple/Google S2S 큐에서 pending notifications 확인 (콘솔 접속).
2. 벤더 전체 장애 여부 — [Apple System Status](https://developer.apple.com/system-status/) · [Google Cloud Status](https://status.cloud.google.com/).
3. 벤더 살아있는데 우리 쪽만 못 받고 있으면:
   - Cloudflare/ALB 차단 확인
   - 백엔드 `/webhooks/apple` 엔드포인트 200 반환 여부
   - JWS 검증 실패 시 `INVALID_RECEIPT` 로그 급증 → verifier 인증서 체인 문제 (Apple 루트 cert 만료 등)
4. 유저 개별 복구: 지원 티켓의 요청 ID로 `purchase_transactions` 조회 → 수동 `markFulfilled` + 보상 fulfiller 호출 (주의: ADMIN_GRANT 소스로 기록, `memo`에 "manual recovery ticket=##### by @admin" 남길 것).

**ADR 참조**: ADR-019.

### 4.3 Chat WebSocket 연결 실패 폭증 (Sev-2/3)

**증상**: 모바일 앱에서 채팅방 진입 시 WS 연결 실패율 급등. 유저 관점 "메시지 안 보내짐".

**1차 대응**:

1. `/chat` namespace 인증 실패가 원인인지 (401 경로) — JwtAuthGuard 스로틀 여부.
2. 인증 통과 후 WS 끊기면 — 인프라 WAF/LB의 WS 타임아웃 설정 확인.
3. Redis 연결 소진 (BullMQ + ioredis 동시 클라이언트 수 확인) — `CLIENT LIST | wc -l`.

**한계**: 일반 HTTP와 달리 WS는 rate limit 적용 어려움. 연결 폭증 유저별 차단은 현재 미구현. 복구 안 되면 **채팅 기능만 킬 스위치** 고려.

### 4.4 BullMQ 큐 백로그 (Sev-3)

**증상**: 자동 메시지 발송 지연, ranking snapshot 누락, `leaderboard-audit` 누적.

**1차 대응**:

1. Redis에서 `LLEN bull:<queue>:waiting` 확인.
2. 로그에서 `OnWorkerEvent('failed')` grep → 어떤 job이 반복 실패인지.
3. 특정 job이 poison pill이면: Redis에서 해당 job 수동 제거, 원인 찾기.

**주의**: `leaderboard-audit` 큐는 매시 cron — 백로그가 쌓이면 오히려 무의미한 중복 실행. removeOnComplete가 설정되어 있으므로 backlog 제한 유지.

### 4.5 Database connection pool exhaustion (Sev-1)

**증상**: 모든 API가 `PrismaClientKnownRequestError: Timed out` 또는 /health의 db=down.

**1차 대응**:

1. RDS / Postgres max_connections 확인. Prisma 기본 pool은 CPU×2+1 수준.
2. `SELECT pid, query_start, state, query FROM pg_stat_activity ORDER BY query_start` — 오래 매달린 쿼리 식별.
3. 원인 쿼리 찾으면 `pg_cancel_backend(pid)` → 코드 수정 배포.
4. 근본 원인 없이 트래픽 폭증이라면 **읽기 전용 경로만 CDN/캐시**로 완화 (catalog · photocards/sets 는 캐시 가능).

### 4.6 Regulatory incident (Sev-1)

**트리거**: 언론 문의 · 게임물관리위원회 공문 · 청소년보호 관련 민원 · 개인정보 침해 신고.

**즉시 조치**:

1. **답변 금지** — 비공식 발언(SNS 포함)조차 금함. "법무 확인 후 답변" 표준 문구만.
2. PO + 법무 동시 호출 (Slack + 전화).
3. 문의/공문 원본 스캔 → `#legal-escalation` 공유.
4. 관련 FAQ·ADR 확인하고, 즉시 조치 필요 여부 (예: 상품 일시 중단) 법무 판단 대기.

**관련 문서**:
- [ADR-016 가챠 확률 공개](../adr/ADR-016-photocard-gacha-disclosure.md)
- [ADR-018 trade 미구현](../adr/ADR-018-photocard-trade-deferred.md)
- [법무 자문 브리프](../legal/youth-payment-limit-brief-ko.md)
- [Support FAQ §6 에스컬레이션 가이드](../support/faq-ko.md#6-에스컬레이션-가이드)

### 4.7 환불 폭주 (Sev-2)

**트리거**: 단일 상품에 환불 요청이 24시간 내 10건 초과.

**의심 경로**:
- 결제 버그 (이중 과금 · 미지급) — 우선 조사.
- 가챠 이슈 (LEGENDARY 안 나옴 집단 제기) — ADR-016 확률 공개로 1차 방어지만, 확률과 실제 분포가 괴리된 경우 실제 이슈.
- 악의적 환불 어뷰징 (크레딧카드 chargeback).

**1차 조치**:
1. `purchase_transactions` 최근 24h 집계, 상품·사용자·상태 피벗.
2. 환불 근거별 분류 (Apple S2S REFUND / 수동 / chargeback).
3. 전체 10건 이상이면 해당 **상품 일시 비활성화** (CMS → Commerce → active toggle off).
4. 법무/PO 에스컬레이션.

---

## 5. 배포 전 체크리스트 (GA 첫 배포)

- [ ] DB 마이그레이션 backup 확인 (RDS snapshot 최신 < 1h)
- [ ] 통합 테스트 `pnpm test:integration` green (T-084, 현재 121/121)
- [ ] 유닛 테스트 green (현재 129/129)
- [ ] **HIBP_CHECK_ENABLED=1** 설정 확인 (staging/prod) — NIST SP 800-63B §5.1.1.2 breach DB 조회
- [ ] **Redis 운영** — account lockout 카운터 (`login:fail:*` keys, 15분 TTL) 가 Redis 의존하므로 Redis 다운 시 lockout 미동작 (graceful — `INVALID_CREDENTIAL` 401만 반환). Redis HA 검토.
- [ ] `pnpm --filter @a-idol/cms build` 성공
- [ ] 모바일 EAS build 성공 + TestFlight/Internal Testing 1회 회귀
- [ ] Apple / Google 상품 카탈로그 등록 완료 (IAP 출시 시)
- [ ] 법무 회신 수신 (청소년 결제 한도 · 서비스 분류)
- [ ] Support FAQ 법무 검수 완료
- [ ] /health의 `redis: 'up'` + `db: 'up'` 확인
- [ ] 관리자 계정 비밀번호 rotation (초기 `admin-dev-0000` 폐기)
- [ ] **Prometheus 스크래이프 ACL 설정** — `/metrics` 외부 차단 확인 (§1.4)
- [ ] **Prometheus 알람 적용** — 5xx-Burst / p95-Latency / Event-Loop-Lag (§1.4)
- [ ] **CORS_ORIGINS 환경변수 검증** — 모바일 + CMS 도메인만 (`,` 구분, allowlist)
- [ ] Sentry DSN 설정 (옵션: 연기 가능)
- [ ] Runbook 이 문서 + 법무 브리프 + ADR-014/015/018/019 링크 모음 `#ops-docs` 채널 Pin

---

## 6. Post-incident 기록 형식

Sev-1/2 발생 시 24h 내 다음 템플릿으로 작성 → `docs/ops/postmortems/YYYY-MM-DD-slug.md`:

```markdown
# [YYYY-MM-DD] <한 줄 제목>

**Severity**: Sev-N · **Impact duration**: X분 · **Affected**: ~Y명

## Timeline
- HH:MM — 최초 신호 (어떻게 감지?)
- HH:MM — 1차 조치
- HH:MM — 복구

## Root cause

## What went well / badly

## Action items
- [ ] @owner — 설명 — due YYYY-MM-DD
```

**원칙**: 비난 없는 post-mortem. 사람 아닌 시스템의 실패를 파악.

---

## 7. 변경 이력

| 날짜 | 내용 |
|---|---|
| 2026-04-23 | 초안 작성 (GA 전 회람 대기). Phase C 체크리스트 T-086 연계. |
| 2026-04-26 | §1.4 메트릭(Prometheus) + §1.5 helmet/rate-limit 추가 (T-080 + T-082). 배포 체크리스트에 스크래이프 ACL · 알람 · CORS allowlist 항목 추가. 테스트 카운트 갱신 (113 unit / 86 ITC). |
| 2026-04-26 | `THROTTLE_LIMIT_PER_MINUTE` env override 추가 — k6 staging 측정 시 100k 등으로 상향 가능. §1.5에 사용 예시 + prod 복귀 경고. |
| 2026-04-26 | T-082 후속 — `AppExceptionFilter` 5xx capture 강화. method/url/reqId/userId 컨텍스트 + 풀 stack 으로 pino error 라인. HttpException 5xx 도 동일 capture. ADR-017 reqId 와 정합. |
| 2026-04-26 | T-083 모바일 a11y first-pass — 7 핵심 화면 25+ Pressable에 accessibilityRole/Label/Hint/State 적용. [a11y-mobile-baseline-ko.md](./a11y-mobile-baseline-ko.md) 신설 (적용 범위 + WCAG AA 후속 백로그). |
| 2026-04-26 | T-084 ITC 보강 — ITC-MYVOTES 4건(인증/빈/hydrate/검증) + ITC-AUTH-005·006(refresh rotation/bogus) 추가. 92/92 ITC. |
| 2026-04-26 | **BUG FIX** — refresh token rotation이 sid mismatch로 항상 401이던 결함 수정. signup/login에서 mint한 sid를 DB AuthSession.id 로도 사용하도록 `AuthSessionRepository.create({id, ...})` 시그니처 확장. JWT 결정성 회피를 위해 RFC 7519 §4.1.7 `jti` (random UUID nonce) 도 access/refresh 페이로드에 추가 — 같은 second에 회전된 토큰도 unique. ITC-AUTH-005가 회귀 커버. |
| 2026-04-26 | `POST /api/v1/auth/logout` 신설 — refresh token으로 server-side session revoke. Idempotent (bogus token도 silent 200). 모바일 signOut의 클라이언트-only revoke 한계 해소. ITC-AUTH-007/008 추가 (94/94). |
| 2026-04-27 | T-082 NIST SP 800-63B 정렬 password policy — 흔한 비밀번호 blocklist + 흔한 root(password/qwerty/admin/aidol/...) 포함 짧은(≤12) 비밀번호 거부. 길이 ≥13 passphrase 는 root 허용 (NIST 권장 길이 우선). `IsStrongPassword` class-validator decorator. ITC-AUTH-009/010/011 + 5 unit case. 97 ITC / 118 unit. |
| 2026-04-27 | T-082 admin auth audit — admin JWT에 jti(RFC 7519) 추가 (사용자 토큰과 동일 정책). admin login 라우트 throttle 10/min/IP override (brute-force 차단). seed.ts에 NODE_ENV 가드 — staging/prod에서 `admin-dev-0000` 자동 거부 (`ALLOW_DEV_ADMIN_SEED=1` 명시 우회). ITC-ADMIN-AUTH 4건. 101 ITC / 118 unit. |
| 2026-04-27 | T-082 admin session DB persistence — `admin_auth_sessions` 테이블 + 마이그레이션 + Repo + sid embed in JWT + hash verification. `POST /api/v1/admin/auth/logout` 신설 (server-side revoke). 회전 후 옛 token reuse → defensive revoke. ITC-ADMIN-AUTH-005~007 추가 (총 7건). 104 ITC. |
| 2026-04-27 | CMS 로그아웃 버튼을 `/api/v1/admin/auth/logout` 와 연동 (`useLogout` hook). server revoke + ETag 캐시 invalidate + zustand store clear. 네트워크 실패해도 로컬 정리 보장 (try-finally). build 성공. |
| 2026-04-27 | T-084 ITC-IDOL-AUTHZ 5건 추가 — public `/api/v1/idols/:id` 의 publishing/visibility 경계 회귀 잠금. draft/published/unpublish/soft-deleted 4 상태 + user vs anonymous 가시성 동등. 109/109 ITC. |
| 2026-04-27 | T-082 CSP enable — Swagger UI 호환 directives (`'unsafe-inline'` script/style 허용, 외부 src 차단 유효). default/script/style/img/font/connect/frame-ancestors/object/base-uri/form-action + upgrade-insecure-requests. /docs HTML + JS bundle + /docs-json 모두 200. ITC TC-SEC-004. 110/110 ITC. |
| 2026-04-27 | T-087 CS workflow stub — [`docs/support/cs-workflow-ko.md`](../support/cs-workflow-ko.md) 초안. 환불/탈퇴/복구/결제이상/신고/채팅차단 6 카테고리 + Tier 1~3 escalation tree + 3 응대 템플릿. SLA 표 + Slack 채널 4개(`#cs-tier1/2/3`, `#incident-live`) 정의. PO + 법무 검수 후 GA 직전 활성화. |
| 2026-04-27 | T-082 HIBP password breach DB 통합 — k-anonymity API (`api.pwnedpasswords.com/range/{prefix}`) + 첫 5자 SHA-1 prefix만 전송. `BreachPasswordChecker` 포트 + `HibpPasswordChecker` 구현. `HIBP_CHECK_ENABLED=1` env로 staging/prod 활성화 (default off). 네트워크 실패는 graceful pass (DoS 방지). signup → 매칭 시 `BREACHED_PASSWORD` 422. shared `ErrorCodes.BREACHED_PASSWORD` + AppExceptionFilter 매핑. 7 unit tests (1 signup + 6 HIBP). 125 unit / 110 ITC. |
| 2026-04-27 | T-082 account lockout — NIST §5.2.2. Redis counter `login:fail:{email}` (15분 TTL, 임계 10회). credential stuffing 방어 (IP throttle 와 별도 layer). 잠긴 계정 → 423 `ACCOUNT_LOCKED` + `details.retryAfterSec`. 성공 시 카운터 리셋. 존재 안 하는 이메일도 카운트 (enumeration 방어). `LoginAttemptThrottle` 포트 + Redis 구현. 4 unit tests + 1 ITC. 128 unit / 111 ITC. |
| 2026-04-27 | T-082 admin login도 동일 account lockout 적용 (parallel security). `LoginAttemptThrottle` 을 IdentityModule export → AdminOpsModule 에서 재사용. user/admin email pool 분리되어 있어 namespace 충돌 없음. 11번째 admin 로그인 실패 시 423 + IP throttle (10/min) 보다 더 길게(15분) 유지됨. |
| 2026-04-27 | Mobile login 폼 ACCOUNT_LOCKED 423 친절 메시지 — `ApiError.details.retryAfterSec` 노출. "약 N분 후 다시 시도해 주세요" 표시. ApiError 클래스에 `details?: unknown` 추가. |
| 2026-04-27 | **GA target 4주 단축** — 2026-08-29 → **2026-08-01**. CLAUDE.md / docs/README.md / dev-plan / phase-c-checklist 갱신. Phase D는 별도 sprint 분리 대신 Phase C 와 병렬 진행으로 흡수. |
| 2026-04-27 | T-085 store submission stub doc 신설 ([`store-submission-checklist-ko.md`](./store-submission-checklist-ko.md)) — Apple/Play 메타데이터 + Privacy Manifest + Data Safety + 스크린샷 specs + 1차 제출 체크리스트 + 거절 사유 점검. **2026-07-15 1차 제출 권장**으로 GA(8-01) 정렬. |
| 2026-04-27 | CMS login 폼 ACCOUNT_LOCKED 423 친절 메시지 — `ApiError.details.retryAfterSec` 노출. ApiError 클래스에 `details?: unknown` 추가. mobile + cms 양쪽 일관 처리. |
| 2026-04-27 | Cast vote 후 cross-entity ETag invalidation — `useVote.cast`에서 `/me/votes` + `/rounds/:id/leaderboard` + `/me/vote-tickets` 3 prefix 자동 무효화. 토글 직후 refresh가 stale ETag 안 보냄. |
| 2026-04-27 | SCR-025 settings 화면 5 ThemeChip + back 버튼 a11y. accessibilityState selected + accessibilityHint. |
| 2026-04-27 | T-084 ITC-ADMIN-PHOTOCARD-AUTHZ 4건 추가 — 인증 없음 401 / user JWT 401 / admin 200 / operator read OK + write 403. 115/115 ITC. |
| 2026-04-27 | T-080/T-081 staging 인프라 체크리스트 ([`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md)) 신설 — AWS topology + Sentry SaaS 통합 plan + k6 5단계 ramp + 비용 추정 + ETA. critical path 정의 (2026-07-08 staging 셋업, 2026-07-15 1차 store 제출). |
| 2026-04-27 | T-080 보안 관측 metric — `auth_login_failures_total{kind=user\|admin}` + `auth_account_locked_total{kind=user\|admin}` counter 추가. user/admin login usecase 양쪽에서 wire (`@Optional()` MetricsService). MetricsModule `@Global()` 화. 2 신규 알람: A-idol-Login-Failure-Burst (5min > 50건 → Sev-2), A-idol-Admin-Account-Locked (10min > 0 → Sev-2). 129 unit / 115 ITC. |
| 2026-04-27 | T-080 Sentry SDK 스캐폴딩 — `@sentry/node` 설치 + `main.ts` Sentry.init (DSN 비어있으면 skip, graceful no-op) + `AppExceptionFilter.captureServerError` 가 5xx 마다 `Sentry.captureException` 호출 (statusCode/method/route 태그 + reqId/userId extra). SENTRY_DSN / SENTRY_TRACES_SAMPLE_RATE env 추가. PII redact (cookie/Authorization). DSN 발급 즉시 활성. |
| 2026-04-27 | T-082 + CS 보강 — `POST /api/v1/admin/operators/unlock-account` admin 전용 endpoint 추가. `UnlockAccountUseCase` (`LoginAttemptThrottle.clearFailures`) + audit log. ITC TC-AUTH-UNLOCK + TC-AUTH-UNLOCK-AUTHZ. cs-workflow §6.3 절차 추가 (admin이 잠긴 사용자 즉시 해제). 117/117 ITC. |
| 2026-04-27 | CMS unlock UI — operators 페이지에 `UnlockAccountPanel` (email input + 잠금 해제 버튼 + amber 경고 박스). admin role 전용 ops 운영성 개선. |
| 2026-04-27 | T-080 Sentry SDK 3축 통합 완료 — Backend(`@sentry/node`) · CMS(`@sentry/react` + ErrorBoundary + Replay) · Mobile(`@sentry/react-native`). 모두 DSN 비어있으면 graceful no-op. PII redact (cookie/Authorization). DSN 발급 시 즉시 활성. |
| 2026-04-27 | dev-plan §4.1 GA 4주 단축 replan — S6+S7 통합(2주 압축, M4 2026-07-18) → S7/S8 GA Hardening 2주(k6 본 측정 + 스토어 1차 제출 buffer + 심사 + 인프라 + QA). M5 GA 2026-08-01 확정. |
| 2026-04-27 | T-086 postmortem template ([`docs/ops/postmortems/_TEMPLATE.md`](./postmortems/_TEMPLATE.md)) — TL;DR · timeline (KST) · 5-whys root cause · went well/badly · action items (owner+due+PR link) · blameless 원칙. CLI 사용 가이드 포함. |
| 2026-04-27 | T-084 ITC-ADMIN-CATALOG-AUTHZ 4건 추가 — 인증 없음/user JWT/admin/operator RBAC 경계. operator는 catalog read+write OK이지만 DELETE는 admin only(403). 121/121 ITC. |
| 2026-04-27 | T-085 CMS 디자인 자산 관리 메뉴 신설 — `/api/v1/admin/design-assets` (admin write / operator read) + `design_assets` 테이블 + `DesignAssetType` (APP_ICON/SCREENSHOT/FEATURE_GRAPHIC/SPLASH/PREVIEW_VIDEO/PERSONA_IMAGE/PHOTOCARD_ART/OTHER) · `DesignAssetPlatform` (IOS/ANDROID/WEB/ALL) · `DesignAssetStatus` (PLACEHOLDER → DRAFT → APPROVED → LEGAL_REVIEWED → SHIPPED) enum. CMS `/design-assets` 페이지 (type별 그룹 + inline status select + create panel). 10건 placeholder seed (앱 아이콘/스플래시/Play feature graphic/iOS App Preview Video + 6 스크린샷 — store-submission-checklist §1.4 매칭). T-085 30% → 45%. |
| 2026-04-27 | CMS 프로젝트 관리 메뉴 신설 — `/api/v1/admin/project-docs` (admin write / operator read) + `project_documents` 테이블 + `ProjectDocCategory` (ADR/DESIGN/IMPLEMENTATION/DELIVERABLE/REPORT/OPS/OTHER) · `ProjectDocStatus` (DRAFT/REVIEW/APPROVED/ARCHIVED) · `ProjectDocSourceType` (FILE/INLINE) enum. CMS `/project` 라우트 (sub-nav: 개요/문서/산출물/WBS/태스크) + `react-markdown` + `remark-gfm` 도입. 39 문서 시드 (ADR 12 + DESIGN 7 + IMPLEMENTATION 6 + REPORT 9 + DELIVERABLE 5 — design-asset-cms 3종 + 수행계획서/중간보고서 INLINE placeholder). 산출물 페이지에서 admin 은 신규 작성/편집/삭제 (`@MaxLength(500_000)` 본문). content 변경 시 version 자동 증가. WBS / Tasks 뷰는 WBS 마크다운을 파싱해 phase/검색 필터 표 제공. CRUD 스모크 통과 (201 → 200 v2 → 204). |
| 2026-04-27 | **Staging 배포 자산 신규** — `a-idol-stg.amoeba.site` (125.133.49.165) 단일 VPS 대응. `deploy/staging/` 신설: `docker-compose.staging.yml` (postgres + redis + backend Docker + nginx + certbot, 모두 internal 통신, 80/443 만 외부 노출), `nginx/conf.d/a-idol-stg.conf` (HTTP→HTTPS 강제 + ACME webroot + /api 프록시 + /metrics 차단 + CMS SPA fallback), `nginx/snippets/{ssl-strong,security-headers}.conf` (Mozilla intermediate TLS + helmet 동등 헤더 + CSP), `.env.staging.example` (시크릿 템플릿, 본체 gitignore), `deploy.sh` (rsync + remote `compose up --build` + `prisma migrate deploy` + 60s health polling + atomic release symlink + 7개 보존), `init-tls.sh` (1회 Let's Encrypt 발급). 가이드: [`docs/ops/staging-deploy-vps-ko.md`](./staging-deploy-vps-ko.md). 기존 [`staging-infra-checklist-ko.md`](./staging-infra-checklist-ko.md) 의 AWS plan 은 보존 (ARR / k6 50k 측정 후 cutover 결정). 1차 staging 진입 시점은 시크릿 채움 + SSH key 등록 후 `./deploy/staging/deploy.sh` 1발. |
| 2026-04-27 | CMS chunk splitting — vite production 단일 chunk 930KB(gzip 283KB) → main entry **22KB(gzip 8KB)** + vendor 분리 (react/query/markdown/sentry/form/ui/store) + route lazy import. Sentry SDK 는 `VITE_SENTRY_DSN` 비어있으면 dynamic import skip → DSN 미설정 시 첫 페이지 로드 ~125KB(gzip) (-56%). DSN 설정 시 lazy 470KB(gzip 155KB) 추가 fetch. AppShell `<Outlet>` 을 `<Suspense fallback="불러오는 중...">` 으로 감싸 모든 child route lazy 안전. |
| 2026-04-27 | T-089 / ADR-023 — audition + vote 모듈 완료 (7/10). 6개 audition DTO 클래스 (Audition/Round CRUD + AddEntries + UpsertVoteRule) + vote.controller CastVoteBody. admin-audition.controller 7개 매핑 + vote.controller 2개 매핑. CMS audition admin-api boundary transform (createAudition/updateAudition/addEntries/createRound/upsertVoteRule) + mobile castVote 변환. ITC: audition/vote/leaderboard-cache/my-votes/etag spec 5건 + audition-fixtures helper atomic. 129/129 ITC + 57/57 mobile pass. T-089 60% → 70%. |
| 2026-04-27 | T-089 / ADR-023 — fandom (no-op) + chat (no-op) + commerce 모듈 완료 (6/10). commerce: `priceKrw`/`deliveryPayload`/`isActive`/`productId`/`providerTxId`/`receiptJws` → snake_case. shared CreatePurchaseDto + mobile useCommerce + CMS createProduct/updateProduct (boundary transform) + ITC commerce/photocard/vote/audition/authz spec atomic. fandom (cheer.dto) / chat (send-message.dto) 는 단일 토큰 필드만이라 변환 없음 (no-op 진행). 129/129 ITC pass. T-089 30% → 60%. |
| 2026-04-27 | T-089 / ADR-023 — catalog 모듈 완료 (3/10). agencyId/stageName/heroImageUrl/publishImmediately/startAt/endAt/includeDeleted → snake_case. 7개 DTO 클래스 + admin-catalog.controller 5개 매핑 + shared 4개 interface (UpdateIdolDto/CreateIdolDto/CreateScheduleDto). CMS는 boundary transform 패턴 (UI form camelCase 유지, admin-api 보더리에서 변환) — feature-page 변경 0건으로 마이그레이션 비용 최소. ITC idol-authz/leaderboard-cache 4건 atomic. T-089 20% → 30%. |
| 2026-04-27 | T-089 / ADR-023 — admin-ops 모듈 완료 (2/10). `AdminRefreshDto.refreshToken` → `refresh_token`. backend admin-auth.controller refresh/logout 매핑 + CMS use-logout body + ITC admin-auth.spec 6건 동시. 129/129 ITC pass. T-089 10% → 20%. |
| 2026-04-27 | T-089 / ADR-023 — Request DTO snake_case migration **identity pilot 완료**. signup/login/refresh/logout/update-me 의 `deviceId`/`refreshToken`/`avatarUrl`/`marketingOptIn`/`pushOptIn` → snake_case. backend DTO 4개 + 컨트롤러 매핑 + shared `UpdateUserMeDto` + mobile client + AuthContext + extra.tsx + ITC 3개 (auth/security/update-me) 모두 atomic 갱신. **129/129 ITC + 57/57 mobile test pass**. 잔여 9개 모듈은 모듈별 hard-cutover (ADR-023 §모듈 우선순위). |
| 2026-04-27 | T-084 — `ITC-ADMIN-DESIGN-ASSETS-AUTHZ` 4건 + `ITC-ADMIN-PROJECT-DOCS-AUTHZ` 4건 추가. 인증 없음 401 / user JWT 401 / admin CRUD 200~204 + version 자동 증가 + slug duplicate 409 + slug 형식 400 + 미존재 404 / operator read 200 + write(POST/PATCH/DELETE) 403. **harness `setGlobalPrefix('api')` 누락 fix** (기존 admin-photocard-authz 도 깨져 있던 것을 발견 — 한 곳 수정으로 모두 복구) + `operatorLogin` upsert 변경 (외부 작업이 password 바꿔도 idempotent). 121 → **129** ITC. 24/24 spec pass. |
