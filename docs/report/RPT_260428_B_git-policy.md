---
document_id: RPT-260428-B
version: 1.0.0
status: Final (snapshot)
created: 2026-04-28
author: Gray Kim <gray.kim@amoeba.group>
---

# [RPT-260428-B] Git 배포 정책 정리

## Report Metadata

| 항목 | 값 |
|---|---|
| **리포트 ID** | RPT-260428-B |
| **제목** | A-idol Git Workflow & Deployment Policy — Current State + Gap |
| **작성일** | 2026-04-28 |
| **작성자** | Gray Kim <gray.kim@amoeba.group> |
| **분류** | 정책 정리 / 갭 분석 (Policy Audit) |
| **트리거** | repo `KimIgyong/a-idol` → `amoeba-devops/a-idol` 이전 직후, branch protection 등 새 repo 설정 시점에 정책 명문화 필요 |
| **분석 대상** | [`CLAUDE.md`](../../CLAUDE.md), [`docs/amb-starter-kit/amoeba_code_convention_v2.md`](../amb-starter-kit/amoeba_code_convention_v2.md) §15, [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml), [`.gitignore`](../../.gitignore), git log (31 commits) |
| **관련 리포트** | [RPT-260428-A](RPT_260428_staging-deploy.md) — 스테이징 배포 정리 |

---

## 1. Executive Summary

A-idol 의 git 정책은 [`CLAUDE.md`](../../CLAUDE.md) §"Code rules" 와 §"amb-starter-kit deviations" 표에 단편적으로 흩어져 있다. 본 리포트는 **현행 정책 (명문화된 것 + 실제 동작) → amb-starter-kit 표준과의 차이 → 갭과 권장 보강**을 한 곳에 정리한다.

### 1.1 한 줄 요약

| 항목 | 명문화 | 실제 동작 | 갭 |
|---|---|---|---|
| Branch 모델 | `main` + `feature/*` (CLAUDE.md) | `main` 단일 (main 직접 push) | `feature/*` PR 패턴 미시행, `production` 미존재 |
| Commit 컨벤션 | Conventional Commits **with scope** | 31 commits 중 30건 (97%) 준수 | `ops(staging):` 1건 비표준 type — 거의 완전 |
| CI 트리거 | `main`, `develop` push/PR | `develop` 미존재 → 실효 트리거는 `main` 만 | `develop` 명세 정리 필요 |
| Branch protection | 없음 (이전 직전까지) | — | **신 repo 셋업 시 필수** (§ 5.2) |
| 자동 배포 | 미정의 | staging 수동 스크립트, prod 미존재 | CD 정책 부재 |
| Tag / Release | 없음 | 0 tags | semver / release 정책 미정 |
| Hooks | 없음 | — | pre-commit / commit-msg lint 옵션 |

### 1.2 권장 (우선순위)

1. **신 repo branch protection** — 즉시 (§ 5.2)
2. **`develop` 처리 결정** — 사용 / 폐기 / `staging` 으로 rename (§ 5.3)
3. **PR-merge 전략 명문화** — squash vs merge commit (§ 5.4)
4. **Hotfix 절차 정의** — production 환경 등장 시점에 필수 (§ 5.5)
5. **Tag / Release 정책** — GA (2026-08-01) 전까지 (§ 5.6)
6. **CI 에 deploy job 추가** — staging 자동 배포 옵션 (§ 5.7)

---

## 2. 현행 정책 (As-is)

### 2.1 명문화된 정책 — CLAUDE.md

```text
- Language: English in code/comments/commits. Korean welcome in specs and
  user-facing strings.
- Commits: Conventional Commits with scope (A-idol deviation from
  amb-starter-kit — scope kept for module clarity).
  feat(chat): …, fix(identity): …, docs(wbs): …
- Branches: feature/<issue>-<desc>, bugfix/<issue>-<desc>, docs/<issue>-<desc>
- Migrations: pnpm --filter @a-idol/backend prisma:migrate -- --name <short-name>
- Don't commit .env; only .env.example is versioned.
```

amb-starter-kit deviation 표 (CLAUDE.md):

| amb-starter-kit rule | A-idol status |
|---|---|
| Commit messages | ⚠️ A-idol deviation — **scope retained** (`feat(chat): …`) rather than amb-starter-kit's `feat: …` |
| Git branches (`production` + `main` + `feature/*`) | ⚠️ A-idol currently uses `feature/<issue>-<desc>`; production/main alignment TBD when CI is added |

### 2.2 실제 git 운영 (snapshot 2026-04-28)

| 항목 | 값 |
|---|---|
| Default branch | `main` |
| 활성 브랜치 | `main` 1개 (로컬/원격 동일) |
| 총 커밋 | 31 |
| 태그 | 0 |
| Conventional 준수 (type) | **30 / 31 (97%)** |
| 비표준 type 1건 | `ops(staging): Prometheus rules + Sentry alerts + /metrics IP-allowlist` (`ops` 는 표준 type 외) |
| Scope 사용률 (전체) | 약 90% (대부분 `feat(<module>):`, `test(<module>):`, `chore(<scope>):`) |
| Co-Authored-By 트레일러 | 최근 커밋부터 사용 (Claude Opus 4.7) |
| Branch protection | **미설정** (전 repo 부터 — 이번 transfer 후 새로 설정 예정) |
| `.env` 추적 | 없음 (`.env.example` 만) ✅ |
| `.gitattributes` | 없음 |
| `.githooks/` | 없음 |
| `init.defaultBranch` | `main` |
| credential.helper | `osxkeychain` (macOS local) |

### 2.3 .gitignore 핵심 규칙

```
node_modules/                           # deps
dist/, build/, *.tsbuildinfo            # build output
packages/backend/uploads/               # generated assets
.env, .env.*.local !.env.example        # secrets
.vscode/* 외 settings/extensions 만 노출
packages/backend/prisma/migrations/**/migration.sql.bak  # prisma 자동 백업 차단
```

추가로 [`.dockerignore`](../../.dockerignore) (2026-04-28 신규) — 빌드 컨텍스트 위생용. RPT-260428-A § 6.1 참조.

### 2.4 CI 정의 — `.github/workflows/ci.yml`

| Job | 트리거 | 내용 | 비고 |
|---|---|---|---|
| `lint-test` | push/PR `main` `develop` | pnpm install · prisma generate · shared build · lint · typecheck · `pnpm -r test` (unit + mobile hooks) · backend + cms build | Postgres/Redis 미사용, 빠른 피드백 |
| `integration` | push/PR `main` `develop` | postgres:16-alpine + redis:7-alpine service · prisma migrate · seed · `test:integration` (10 suites / 45 tests) | CI 전용 시크릿 (HEX 32) 인라인 |
| `phase-c-summary` | always (lint-test + integration 후) | `scripts/phase-c-status.sh --summary` 결과를 `$GITHUB_STEP_SUMMARY` 에 작성 | 게이트 아님, 정보 전달용 |

> 주의: `develop` 브랜치가 `.github/workflows/ci.yml` 에 명시되어 있지만 실제로는 미존재. `main` 만 활성 → CI 가 사실상 `main` 트리거로만 작동.

### 2.5 배포 (현재)

- **Local dev**: `make dev` / `pnpm dev`
- **Staging**: `./deploy/staging/deploy-shared.sh` 수동 실행 → SSH rsync · docker compose up · prisma migrate deploy · health polling. push 트리거 없음. RPT-260428-A 참조.
- **Production**: 미존재. GA 시점 (2026-08-01) 전까지 결정 필요.

---

## 3. amb-starter-kit § 15 와의 차이

amb-starter-kit v2.0 의 표준 git 정책 (CLAUDE.md 의 reference):

### 3.1 Branch Strategy (kit § 15.1)

| Branch | Purpose | Deploy | Protection |
|---|---|---|---|
| `production` | Production release | Production | PR required, 1 approval |
| `main` | Development integration | Staging | PR required, 1 approval |
| `feature/*` | Feature development | Local | - |
| `hotfix/*` | Urgent fix | - | - |

### 3.2 Development Flow (kit § 15.2)

```
feature/{name}  ─┐
                  ├─►  main  (Squash Merge)
                  │      │
                  │      ├─►  staging deploy
                  │      │
                  │      └─►  production  (Merge Commit)
                  │              │
                  │              └─►  production deploy
                  │
hotfix/{name}  ──┘  (production 분기 → production + main 양쪽 머지)
```

### 3.3 Commit Messages (kit § 15.3)

```
{type}: {description}
type: feat | fix | docs | style | refactor | test | chore | hotfix
예: feat: 사용자 프로필 페이지 추가
```

→ **scope 없음**. A-idol 은 의도적으로 scope 유지 deviation.

### 3.4 차이 요약 표

| 항목 | amb-starter-kit | A-idol 현행 | 차이 사유 |
|---|---|---|---|
| Branch 라인 | `production` + `main` + `feature/*` + `hotfix/*` | `main` + `feature/*` (선언만) | production 환경 부재 — GA 전까지 미적용 합리 |
| `feature/*` 사용 | 의무 | 명문화 / 실제 미사용 (main 직접 push) | 1인 개발 + Phase D 마무리 단계, 빠른 진행 우선 |
| `main` → squash merge | 의무 | 실제 squash 없음 (직접 commit) | PR 자체가 없음 |
| `hotfix/*` | 의무 | 미정의 | production 부재 |
| Commit type | `feat:` (scope 없음) | `feat(chat):` (scope 유지) | 모듈 명확성 — 의도된 deviation |
| Allowed types | `feat / fix / docs / style / refactor / test / chore / hotfix` | + `revert / perf / ci / build` 등 (Conventional 광역) | A-idol 은 Conventional 표준 따름 |
| Branch protection | PR 1 approval | 미설정 | 1인 개발 + 새 repo 직후 |

### 3.5 의도된 deviation vs 정리 부족

- **의도적**: scope 유지, Prisma 사용, 4-level RBAC 단순화, 멀티 테넌시 미적용
- **정리 부족 (이 리포트 트리거)**:
  - `production` 라인 — GA 시점에 추가할지, 단일 `main` 으로 갈지 결정 필요
  - `hotfix/*` 절차 — production 등장 시 반드시 정의
  - PR / Squash 정책 — main 직접 push 를 계속할지, branch protection 으로 강제할지
  - `develop` — CI 에 명시되어 있는데 실체 없음

---

## 4. 실제 동작 vs 정책 갭 (Gap)

### 4.1 PR 우회 — main 직접 push

- **상황**: CLAUDE.md 는 `feature/<issue>-<desc>` 명시하지만 31 commits 모두 `main` 직접 commit + push
- **이유**: 1인 개발, 빠른 iteration, Phase D 마무리 가속
- **문제**: 코드 리뷰 / CI 실패 차단 / 충돌 점검 부재. 이번 staging 배포 작업에서도 docker 이슈 8건이 main 에 직접 들어감 — fail-then-fix 흐름.
- **권장**: 새 repo 의 branch protection (PR required) 시점부터 강제. 단, **임시 self-review 허용** (org 승인자 부족 시) 으로 1단계 부드럽게.

### 4.2 `develop` 브랜치 ghost reference

- **상황**: `.github/workflows/ci.yml` 의 push/PR 트리거에 `develop` 명시되어 있으나 실제 브랜치 부재 → CI 는 `main` 트리거로만 동작
- **권장 (택1)**:
  - **A.** `develop` 도입 (kit § 15 정렬) — main 은 release 타깃으로 바꾸고 develop 으로 일상 통합
  - **B.** `develop` 명세 제거 — `.github/workflows/ci.yml` 트리거에서 삭제
  - **C.** `staging` 으로 rename — `staging` 브랜치 push 시 자동 staging deploy 트리거 추가
- **현실적 선택**: **B → 추후 C** — 지금은 단일 main, 추후 자동 배포 추가 시 `staging`/`production` 브랜치 추가

### 4.3 Tag / Release 부재

- **상황**: 0 tags, GitHub Releases 0
- **권장**: GA 전까지 **semver** + **annotated tag** 도입. 예: `v0.1.0-staging-rc1` (현재 시점 임시 tag), GA 시 `v1.0.0`. Release notes 는 PR squash commit 에서 자동 추출 (e.g. `release-please` 또는 `release-drafter`).

### 4.4 PR template / Issue template 부재

- **상황**: `.github/` 에 templates 없음
- **권장**: 새 repo 에 PR template (FR/T-ID 링크 + checklist), Issue template (task / bug / docs) 추가. WBS Convention 의 `T-XXX`, `FR-XXX`, `ITC-XXX` 트레이서빌리티에 자연스럽게 연결.

### 4.5 Commit message lint 미강제

- **상황**: 컨벤션 준수율 97% 인데 강제 수단 없음 (정책 명문화만)
- **권장 (선택)**: `commitlint` + `husky` (또는 `lefthook`) — 실수 방지. 다만 1인 개발 단계에서 마찰 비용 > 이득 가능성. PR 단위에서만 검사 (PR title check action) 하는 가벼운 옵션 권장.

### 4.6 `.env` 가족 정책 누락 — `.env.staging` / `.env.production` 명시

- **현행**: `.gitignore` 에 `.env, .env.*.local` 만 차단. `.env.staging`, `.env.production` 같은 환경별 파일도 차단 대상이지만 명시적 패턴 부재.
- **현재 우회**: `deploy/staging/.env.staging` 가 [`.dockerignore`](../../.dockerignore) 에는 명시 차단. `.gitignore` 에는 의도하지 않게 들어갈 수 있음 (현재는 안 들어가 있지만 안전 마진 부족).
- **권장**: `.gitignore` 에 `.env.*` (현재 `.env.*.local` 보다 광역) 추가 + `!.env.example` 만 화이트리스트.

---

## 5. 권장 정책 (To-be)

새 repo (`amoeba-devops/a-idol`) 시점에 정착할 정책 제안. 기존 의도된 deviation 은 유지.

### 5.1 Branch 모델 (단계별)

#### Phase D / GA 전 (현재 ~ 2026-08-01)

```
main (default, deploy=staging via 수동 스크립트)
└─ feature/<gh-issue>-<desc>
└─ bugfix/<gh-issue>-<desc>
└─ docs/<gh-issue>-<desc>
```

- `main` 직접 push 금지 → branch protection (PR required, status check pass required)
- `feature/*` PR → squash merge → `main`
- staging 배포는 **수동 트리거** 유지

#### GA 후

```
production (deploy=prod)  ◄── PR (Merge Commit) ◄── main (deploy=staging)
                                                     ├─ feature/*
                                                     ├─ bugfix/*
                                                     └─ docs/*
hotfix/* ──► production + main 양쪽 머지
```

- amb-starter-kit § 15.2 정렬

### 5.2 Branch Protection — 새 repo 즉시 적용

`Settings → Branches → Add branch protection rule` for `main`:

- ✅ Require a pull request before merging
- ✅ Require approvals (1, 단 1인 개발 동안 self-approval bypass 검토)
- ✅ Require status checks to pass — `lint-test`, `integration`
- ✅ Require branches to be up to date before merging
- ✅ Require linear history (squash merge 강제)
- ✅ Include administrators (선택 — 강제력 ↑)
- ❌ Allow force pushes (off)
- ❌ Allow deletions (off)

### 5.3 `develop` 정리 (즉시)

`.github/workflows/ci.yml` 의 트리거에서 `develop` 제거 — ghost reference 정리:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

향후 `staging` 브랜치 도입 시 (5.1 GA 후 모델 또는 staging 자동배포 도입 시) 다시 추가.

### 5.4 Merge 전략

| 대상 | 전략 | 사유 |
|---|---|---|
| `feature/*` → `main` | **Squash merge** | linear history, 단일 의도 단위 |
| `main` → `production` (GA 후) | **Merge commit** | release 경계 보존 |
| `hotfix/*` → `production` + `main` | **Merge commit** | 양쪽에 동일 commit-id 보존 |

GitHub repo 설정: `Settings → General → Pull Requests` 에서 `Allow merge commits` 만 production 머지 시 사용, 나머지는 `Allow squash merging` 만 활성화 권장.

### 5.5 Hotfix 절차 (GA 후)

```bash
# 1. production 에서 분기
git switch production && git pull
git switch -c hotfix/<gh-issue>-<desc>

# 2. 수정 + commit (Conventional `fix(<scope>): ...`)

# 3. PR 두 개:
#    - hotfix/* → production (Merge Commit, 즉시 배포 가능)
#    - hotfix/* → main         (Merge Commit, drift 방지)
```

별도 ADR (예: ADR-024 git workflow) 에 절차 명문화 권장.

### 5.6 Tag / Release 정책

- **버전 규칙**: semver `MAJOR.MINOR.PATCH`
  - MVP GA = `v1.0.0`
  - GA 전 staging 빌드 = `v0.x.y-rc.N` (release candidate)
- **annotated tag**: `git tag -a v0.x.y -m 'Release notes ...'`
- **자동화 (선택)**: `release-please-action` 또는 `release-drafter` — main 머지 squash commit 의 type 분류로 changelog 자동 생성

### 5.7 Commit 컨벤션 보강

CLAUDE.md 의 정의를 다음으로 명확화:

```
{type}({scope}): {subject}

[optional body — wrap at 72]

[optional footer — Refs: T-XXX / FR-XXX / Closes: #N]
```

- **type**: `feat | fix | docs | style | refactor | test | chore | revert | perf | ci | build | hotfix`
  - `style`: 코드 포맷 (no logic change). prettier/eslint --fix 결과
  - `refactor`: 동작 동일, 구조 변경
  - `perf`: 성능 개선 (refactor 와 분리)
  - `chore`: 빌드/도구/의존성 (코드 영향 적음)
  - `revert`: 이전 commit 되돌림
  - `hotfix`: production 긴급 수정 (`fix` 와 구분, 병렬 머지 추적용)
  - **금지**: `ops`, `meta`, etc — 표준 외 type 사용 금지 (현행 1건은 다음 정리 시 보정)
- **scope**: 모듈명 (`identity`, `chat`, `audition`, `vote`, `cms`, `mobile`, `deploy`, `wbs`, `report`, ...) — kebab-case
- **subject**: 영어, 명령형, 50자 이내, 마침표 없음
- **body**: 한국어 환영 (specs / context). 줄바꿈 72자
- **footer**:
  - `Refs: T-080, FR-061` — WBS / 요구사항 트레이서
  - `Closes: #123` — GitHub issue
  - `Co-Authored-By: ...` — Claude / 페어 협업

### 5.8 PR / Issue Template (추후)

- `.github/PULL_REQUEST_TEMPLATE.md` — Summary / Test plan / Refs
- `.github/ISSUE_TEMPLATE/task.md`, `bug.md`, `docs.md` — WBS T-ID, area, priority 라벨 자동 연결

### 5.9 자동 배포 (CI/CD)

| 단계 | 트리거 | 동작 |
|---|---|---|
| **현재** | 수동 (`./deploy/staging/deploy-shared.sh`) | rsync + compose up + migrate |
| **단기 (선택)** | `main` push 시 GitHub Actions 가 SSH → 동일 스크립트 실행 | secret: `STAGING_SSH_KEY`, `STAGING_HOST` |
| **GA 후 권장** | `staging` 브랜치 push → staging 자동 / `production` push → prod 자동 | branch 별 분리 |

[`docs/ops/runbook-ko.md`](../ops/runbook-ko.md) 의 §1.4 / §1.5 와 연동 필요.

### 5.10 `.gitignore` 보강

```
- .env, .env.*.local !.env.example
+ .env, .env.* !.env.example
```

→ `.env.staging`, `.env.production` 등 모든 환경별 파일을 안전하게 차단.

---

## 6. 결정해야 할 사항 (Open questions)

다음 결정이 본 정책의 최종 확정에 필요:

| # | 질문 | 옵션 | 권장 |
|---|---|---|---|
| Q1 | `develop` 브랜치 — 도입 / 폐기 / `staging` rename | A 도입 / B 폐기 / C rename | **B 폐기 → 추후 C** |
| Q2 | GA 전까지 PR 강제할지 | 강제 / 옵션 | **강제 (self-approval bypass 1인 동안만 임시 허용)** |
| Q3 | Production 브랜치 도입 시점 | GA 직전 / GA 후 첫 release / 도입 안함 | **GA 직전** (release 분기점 명확화) |
| Q4 | Squash vs Merge 전략 | squash 일관 / 분리 | **5.4 표 — 분리** |
| Q5 | Commit message lint 자동화 | husky / PR title check / 없음 | **PR title check** (Action 추가, 가벼움) |
| Q6 | Tag 자동화 | release-please / release-drafter / 수동 | **수동 (GA 까지)**, 이후 release-please |
| Q7 | Staging 자동 배포 | 즉시 / GA 후 / 안함 | **GA 후 첫 마일스톤** (현재 수동 충분) |
| Q8 | `ops:` 같은 비표준 type 보정 | rebase / interactive amend / 무시 | **무시** (이미 push 됨, 강제 push 위험 > 이득) |

---

## 7. 즉시 실행 가능한 작업 (Action items)

새 repo (`amoeba-devops/a-idol`) Phase 4 와 함께 처리 가능한 항목:

| 우선순위 | 작업 | 위치 / 방법 |
|---|---|---|
| P0 | Branch protection on `main` | GitHub Settings (§ 5.2) |
| P0 | `.github/workflows/ci.yml` 트리거에서 `develop` 제거 | 1줄 PR (§ 5.3) |
| P0 | `.gitignore` 의 `.env.*.local` → `.env.*` 보강 | 1줄 PR (§ 5.10) |
| P1 | Repository topics + description 갱신 | GitHub UI |
| P1 | Issue label 표준 세트 (`task`, `stage:phase-*`, `area:*`, `priority:P0/P1/P2`) | GitHub UI |
| P1 | PR / Issue template 추가 | `.github/` (§ 5.8) |
| P1 | ADR-024 "Git workflow & deployment policy" 작성 | `docs/adr/` (본 리포트 기반) |
| P2 | PR title check Action | `.github/workflows/pr-title.yml` |
| P2 | `Co-Authored-By` 트레일러 — git config commit.template 또는 hook | local |
| P2 | Annotated tag `v0.1.0-rc.1` (현재 staging 시점 표식) | `git tag -a` |
| P3 | release-please 도입 (GA 전 단계) | 별도 PR |
| P3 | Staging 자동 배포 Action | `.github/workflows/deploy-staging.yml` |

---

## 8. 참조

| 항목 | 위치 |
|---|---|
| 프로젝트 instructions | [`CLAUDE.md`](../../CLAUDE.md) |
| amb-starter-kit § 15 (git convention) | [`docs/amb-starter-kit/amoeba_code_convention_v2.md`](../amb-starter-kit/amoeba_code_convention_v2.md#15-git-convention-git-컨벤션) |
| 코드 컨벤션 (A-idol) | [`docs/implementation/a-idol-code-convention.md`](../implementation/a-idol-code-convention.md) |
| WBS | [`docs/implementation/a-idol-wbs.md`](../implementation/a-idol-wbs.md) |
| CI workflow | [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) |
| Staging 배포 정리 | [RPT-260428-A](RPT_260428_staging-deploy.md) |
| Conventional Commits 표준 | https://www.conventionalcommits.org/ |
| Semantic Versioning | https://semver.org/ |

---

## 9. 다음 단계

1. **본 리포트 결정 항목 (§ 6) 확정** — Q1~Q8 답변
2. **ADR-024 "Git workflow & deployment policy"** 초안 작성 (확정된 정책을 ADR 로 정식화) — 본 리포트가 참조 자료
3. **Phase 4 (새 repo 설정)** 와 함께 § 7 P0 / P1 일괄 적용
4. CLAUDE.md 의 amb-starter-kit deviation 표를 **§ 3.4 차이 표**로 갱신 — TBD 항목들 (production/main alignment 등) 정리된 상태 반영
