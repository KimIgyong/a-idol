# A-idol staging — Sentry alert 권장 설정

> Prometheus rules 가 burst / latency / saturation 을 커버. **Sentry 는 issue
> dedup + stack trace + release 별 grouping** 으로 보완.
> 두 시스템은 중복이 아니라 상호 보강.

## 1. Issue alerts (Sentry UI → Alerts → Issue rule)

### 1.1 새 fingerprint (regression detection)

| 항목 | 값 |
|---|---|
| Trigger | `is created` (새 issue) |
| Filter | `project = a-idol-backend OR a-idol-cms` |
| Action | Slack `#cs-tier2` + email |
| Cooldown | 5 min |
| 정책 | 새 issue 가 하나라도 발생하면 알림. release 별 grouping 으로 regression 식별 용이. |

### 1.2 5xx 빈도 급증

| 항목 | 값 |
|---|---|
| Trigger | `event count > 10 in 5 min` |
| Filter | `level = error AND http.status_code:500..599` |
| Action | Slack `#incident-live` + PagerDuty |
| Cooldown | 10 min |

### 1.3 새 release 의 첫 24h regression

| 항목 | 값 |
|---|---|
| Trigger | `is unhandled AND release_age < 24h` |
| Action | Slack `#cs-tier2` |
| 정책 | deploy 직후 regression 빠르게 잡기. 24h 이후엔 일반 issue alert 로 흡수. |

## 2. Metric alerts (Sentry → Alerts → Metric rule)

Sentry 가 자체 수집한 transaction 메트릭 기반.

### 2.1 Apdex < 0.9

| 항목 | 값 |
|---|---|
| Metric | `transaction.duration p95` |
| Trigger | `> 500ms for 10 min` |
| 정책 | Prometheus p95 alert 와 중복. Prometheus 가 1차, Sentry 는 백업 (alert source 다중화). |

### 2.2 Crash-free rate (모바일)

| 항목 | 값 |
|---|---|
| Metric | `crash_free_session_rate` |
| Trigger | `< 99.5% for 1h` |
| 정책 | 모바일 회귀 감지. EAS build 직후 검증. |

## 3. Slack 채널 매핑 (cs-workflow §3.1 와 정합)

| Sev | 채널 | 응답 SLA |
|---|---|---|
| Sev-1 | `#incident-live` | 15분 |
| Sev-2 | `#incident-live` + email | 30분 (영업 시간) |
| Sev-3 | `#cs-tier3` | 다음 영업일 |
| 새 issue (no fingerprint match) | `#cs-tier2` | 24h 트리아지 |

## 4. 비용 가드

Developer plan free tier:
- 5,000 errors/month
- 10,000 transactions/month
- 30d retention

burn-in 1주일 후 사용량 모니터링. 5k 초과 패턴이면 Team plan ($26/월) 으로 upgrade.

`tracesSampleRate: 0.1` 이라 transactions 부하는 10%만 샘플 — 50k 동시 사용자 시 5k VUs/min × 60 = 300k transactions ÷ 10 = 30k/h. **k6 본 측정 동안은 0.01 로 일시 하향** 권장.
