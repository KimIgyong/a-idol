# [YYYY-MM-DD] <한 줄 제목>

**Severity**: Sev-N · **Impact duration**: X분 · **Affected**: ~Y명 · **Owner**: <이름>

---

## TL;DR (3문장 요약)

1. 무엇이 일어났나
2. 사용자 영향
3. 어떻게 해결됐나

---

## Timeline (KST, 분 단위)

> **원칙**: 시각은 외부 신호 기준 (페이저 수신 시각 / 모니터링 dashboard 표시 시각). 내부 추측은 별도 명시.

| 시각 | 출처 | 사건 |
|---|---|---|
| HH:MM | Sentry alert | 최초 감지 — `A-idol-Backend-5xx-Burst` 발화 (5분간 12건) |
| HH:MM | 당직(Gray) | 페이저 수신 → Sentry issue 페이지 진입 |
| HH:MM | 분석 | root cause 추정 (`PrismaIdolRepository.touchUpdatedAt` undefined) |
| HH:MM | 행동 | runbook §3.1 — `kubectl rollout undo` 실행 |
| HH:MM | 모니터링 | Sentry 신규 issue 발생 0건 확인 |
| HH:MM | 종료 | `#incident-live` 채널에 "복구 완료" 공지 |

**총 MTTD (Mean Time To Detect)**: X분 · **MTTR (Mean Time To Recover)**: Y분

---

## Root cause (근본 원인)

### 직접 원인 (immediate trigger)

<예: v0.4.2 배포 시 `touchUpdatedAt` 메서드 시그니처 변경되어 호출자가 받는 promise rejection 처리 누락>

### 근본 원인 (5 whys)

1. Why 5xx 발생? → `touchUpdatedAt` undefined error
2. Why undefined? → 호출자가 새 시그니처로 마이그레이션 안 됨
3. Why 마이그레이션 누락? → grep 했지만 동적 호출 (`repo[method]`)을 놓침
4. Why 동적 호출? → 5월 리팩터에서 generic helper 도입 (당시 정당)
5. Why 회귀 안 잡힘? → ITC 가 happy path 만 — touchUpdatedAt 실패 path 미커버

### Contributing factors (악화 요인)

- Sentry alert가 정확히 작동했지만 페이저 elevation 룰이 5분 지연 → 가시성 늦음
- 직전 PR review에서 동적 호출 부분 reviewer 1명만 (rotation 관성)

---

## What went well

- Sentry alert + reqId 매칭이 정확히 동작 → 30초 안에 stack 파악
- runbook §3.1 rollback 절차가 잘 구조화되어 있어 망설임 없이 실행
- Slack `#incident-live` 채널이 외부 communication 장벽 낮춤

## What went badly

- ITC 커버리지가 happy path 위주
- 동적 호출 패턴이 정적 분석 회피
- alert rule의 페이저 elevation 5분 지연

---

## Action items

> 모든 액션은 owner + due date + tracking link 필수. PR/Issue 링크로 트래킹.

- [ ] @<owner> — Action 1: 실패 path ITC 추가 (`touchUpdatedAt` 미존재 시 200) — due YYYY-MM-DD — [PR #123](#)
- [ ] @<owner> — Action 2: 동적 호출 lint rule (`@typescript-eslint/no-dynamic-delete` 류) — due YYYY-MM-DD — [Issue #456](#)
- [ ] @<owner> — Action 3: Sentry alert elevation 1분으로 단축 — due YYYY-MM-DD — [#789](#)
- [ ] @<owner> — Action 4: runbook §3.1 에 본 사건 ref 추가 — due YYYY-MM-DD

---

## 비난 없는 회고 (Blameless principle)

> 사람의 실수가 아닌 시스템의 실패. 누가 했는지가 아니라 왜 시스템이 막지 못했는지에 집중.
>
> 같은 상황에서 다른 사람이 같은 결정을 했을 가능성을 인정. 회귀 방어 메커니즘이 부재했음을 시스템 차원에서 보강.

---

## 첨부

- Sentry issue link: <url>
- Pull request that caused: <url>
- Pull request that fixed: <url>
- Related runbook section: §3.1 / §4.X
- 관련 ADR (있다면): ADR-0XX

---

## 사용 가이드

이 템플릿은 [`docs/ops/runbook-ko.md`](../runbook-ko.md) §6 에서 참조됩니다.

새 postmortem 작성 시:

```bash
SLUG=$(date +%Y-%m-%d)-incident-name
cp docs/ops/postmortems/_TEMPLATE.md "docs/ops/postmortems/$SLUG.md"
$EDITOR "docs/ops/postmortems/$SLUG.md"
```

작성 완료 후:
- PO + 당직팀 review (Tier 2 이상 incident 모두)
- 30일 후 action items 회수율 검토
- 분기별 postmortem 모음 retro
