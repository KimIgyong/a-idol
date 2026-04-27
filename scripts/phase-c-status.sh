#!/usr/bin/env bash
# =============================================================
# Phase C 마감 상태 1-pager.
# =============================================================
#
# Runs every gate the GA path cares about (typecheck · lint · unit tests ·
# integration tests · ADR backlog count) and prints a single tight summary
# block. Designed for three callers:
#
#   1. PO/CTO asking "where is Phase C right now?" — copy/paste output.
#   2. CI gate — exits non-zero if any gate fails.
#   3. CI summary job (`--summary`) — markdown output for $GITHUB_STEP_SUMMARY.
#       Reads upstream job results from `$LINT_TEST_RESULT` /
#       `$INTEGRATION_RESULT` env vars (set by `needs.<job>.result`); does
#       NOT re-run gates because they already ran in the upstream jobs.
#
# Skips integration tests in mode 1/2 if Postgres/Redis aren't reachable so
# dev laptops without docker-compose up still get a meaningful partial answer.

set -uo pipefail

MODE="full"
if [[ "${1:-}" == "--summary" ]]; then MODE="summary"; fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── --summary mode (CI) — no gate run, markdown output ─────────────────
if [[ "$MODE" == "summary" ]]; then
  emit_result() {
    case "$1" in
      success)  echo "✅ pass" ;;
      failure)  echo "❌ fail" ;;
      cancelled) echo "⚠️ cancelled" ;;
      skipped)  echo "⊘ skipped" ;;
      *)        echo "❓ ${1:-unknown}" ;;
    esac
  }

  echo "# Phase C status — $(date -u +'%Y-%m-%dT%H:%MZ')"
  echo ""
  echo "| Gate | Result |"
  echo "|---|---|"
  echo "| lint-test (typecheck · lint · unit · build) | $(emit_result "${LINT_TEST_RESULT:-unknown}") |"
  echo "| integration (postgres + redis + e2e) | $(emit_result "${INTEGRATION_RESULT:-unknown}") |"
  echo ""

  # Phase D backlog from ADR-021 (parses strikethrough state).
  adr_file="docs/adr/ADR-021-phase-c-perf-levers.md"
  if [[ -f "$adr_file" ]]; then
    total=$(grep -cE '^- (\*\*|~~\*\*)' "$adr_file" || true)
    closed=$(grep -cE '^- ~~\*\*' "$adr_file" || true)
    open=$((total - closed))
    echo "## Phase D backlog (ADR-021)"
    echo ""
    echo "**${closed} / ${total} items closed (${open} open)**"
    echo ""
  fi

  # ADR roster.
  adr_count=$(ls docs/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' ')
  latest=$(ls docs/adr/ADR-*.md 2>/dev/null | sort | tail -1 | xargs -n1 basename 2>/dev/null || echo "—")
  echo "## ADR roster"
  echo ""
  echo "**${adr_count} ADRs registered** · latest: \`${latest}\`"
  echo ""

  # Cross-links for the reviewer.
  echo "## Reference"
  echo ""
  echo "- [Phase C release notes](../docs/implementation/phase-c-release-notes-ko.md)"
  echo "- [RPT-260425 mid-progress](../docs/report/RPT_260425_phase-c-mid-progress.md)"
  echo "- [ADR-021 perf levers](../docs/adr/ADR-021-phase-c-perf-levers.md)"
  echo "- [k6 staging runbook](../docs/ops/k6-staging-runbook-ko.md)"

  # Exit with appropriate status — failure if any upstream failed.
  if [[ "${LINT_TEST_RESULT:-}" == "failure" || "${INTEGRATION_RESULT:-}" == "failure" ]]; then
    exit 1
  fi
  exit 0
fi

# ── helpers ────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
DIM='\033[2m'
RESET='\033[0m'

ok=0
fail=0
skip=0

# `gate <label> <command...>` runs the command, hiding stdout, and prints a
# one-line PASS/FAIL with timing. Exit status is preserved in $fail.
gate() {
  local label="$1"
  shift
  local start
  start=$(date +%s)
  if "$@" > /tmp/.phase-c-status.log 2>&1; then
    local elapsed=$(( $(date +%s) - start ))
    printf "  ${GREEN}✓${RESET} %-32s ${DIM}%ds${RESET}\n" "$label" "$elapsed"
    ok=$((ok + 1))
  else
    local elapsed=$(( $(date +%s) - start ))
    printf "  ${RED}✗${RESET} %-32s ${DIM}%ds${RESET}\n" "$label" "$elapsed"
    fail=$((fail + 1))
    echo -e "    ${DIM}--- last 6 lines of stderr/stdout ---${RESET}"
    tail -6 /tmp/.phase-c-status.log | sed 's/^/    /'
  fi
}

skip_gate() {
  printf "  ${YELLOW}⊘${RESET} %-32s ${DIM}skipped (%s)${RESET}\n" "$1" "$2"
  skip=$((skip + 1))
}

count_tests() {
  # Parse `Tests: N passed, N total` from a jest log.
  local file="$1"
  awk '/^Tests: +[0-9]+ passed/ { for (i=1; i<=NF; i++) if ($i == "passed,") print $(i-1); exit }' "$file" 2>/dev/null || echo "?"
}

# ── header ─────────────────────────────────────────────────────────────
echo ""
echo "Phase C 마감 상태 — $(date +'%Y-%m-%d %H:%M:%S')"
echo "════════════════════════════════════════════════════════"

# ── 1. Code quality gates ──────────────────────────────────────────────
echo ""
echo "1. Code quality"
gate "typecheck (all packages)"  pnpm -r typecheck
gate "lint (backend + cms)"      pnpm -r lint
gate "shared build"              pnpm --filter @a-idol/shared build

# ── 2. Unit tests ──────────────────────────────────────────────────────
echo ""
echo "2. Unit tests"
gate "backend unit"              pnpm --filter @a-idol/backend test
backend_unit=$(count_tests /tmp/.phase-c-status.log)
gate "mobile hook tests"         pnpm --filter @a-idol/mobile test
mobile_unit=$(count_tests /tmp/.phase-c-status.log)

# ── 3. Integration (conditional on docker services) ────────────────────
echo ""
echo "3. Integration tests"
# Use `services --filter status=running` for stable, non-TTY output. The
# `ps` table format depends on terminal width and trims columns under heavy
# CI output.
if docker compose ps --services --status running 2>/dev/null | grep -qx 'postgres'; then
  gate "backend integration"     pnpm --filter @a-idol/backend test:integration
  backend_int=$(count_tests /tmp/.phase-c-status.log)
else
  skip_gate "backend integration" "docker postgres not running — try \`make up\`"
  backend_int="skip"
fi

# ── 4. Build artifacts ─────────────────────────────────────────────────
echo ""
echo "4. Build"
gate "backend build"             pnpm --filter @a-idol/backend build
gate "cms build"                 pnpm --filter @a-idol/cms build

# ── 5. Phase D backlog (parsed from ADR-021) ───────────────────────────
echo ""
echo "5. Phase D backlog (ADR-021)"
adr_file="docs/adr/ADR-021-phase-c-perf-levers.md"
if [[ -f "$adr_file" ]]; then
  # Items begin with "- **" and may be wrapped in `~~` strikethrough when
  # landed. Count both states.
  total=$(grep -cE '^- (\*\*|~~\*\*)' "$adr_file" || true)
  closed=$(grep -cE '^- ~~\*\*' "$adr_file" || true)
  open=$((total - closed))
  printf "  %s / %s items closed (%s open)\n" "$closed" "$total" "$open"
else
  echo "  (ADR-021 not found at $adr_file)"
fi

# ── 6. ADR roster ──────────────────────────────────────────────────────
adr_count=$(ls docs/adr/ADR-*.md 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "6. ADRs registered: $adr_count (latest: $(ls docs/adr/ADR-*.md | sort | tail -1 | xargs basename))"

# ── summary ────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════"
printf "Summary: ${GREEN}%d ok${RESET} · ${RED}%d fail${RESET} · ${YELLOW}%d skip${RESET}\n" "$ok" "$fail" "$skip"
echo "Tests:  backend unit=$backend_unit · mobile=$mobile_unit · integration=$backend_int"
echo ""

[[ "$fail" -eq 0 ]] && exit 0 || exit 1
