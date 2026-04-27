#!/usr/bin/env bash
# End-to-end smoke test for the running backend. Invoked by `make smoke`.
# Prerequisites:
#   - backend running on :3000 (e.g. `make dev`)
#   - docker-compose postgres + redis up
#   - `make seed` has created the demo user + admin + 99 idols
#
# Exits non-zero on any unexpected HTTP code or curl failure.

set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
API="${BASE}/api/v1"

pass() { printf "\033[32m ✓\033[0m %s\n" "$1"; }
fail() { printf "\033[31m ✗\033[0m %s\n" "$1" >&2; exit 1; }
step() { printf "\n\033[34m●\033[0m %s\n" "$1"; }

probe() {
  local name=$1; local expected=$2; shift 2
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" "$@")
  if [[ "$code" == "$expected" ]]; then pass "$name (HTTP $code)"; else fail "$name (got HTTP $code, wanted $expected)"; fi
}

json_field() { node -e "process.stdin.on('data',d=>{try{console.log(JSON.parse(d).$1 ?? '')}catch{console.log('')}})"; }

# ── 1. Health ────────────────────────────────────────────────────
step "health"
curl -fsS "$BASE/health" >/dev/null && pass "GET /health"

# ── 2. User auth + identity ──────────────────────────────────────
step "identity"
# signup may 409 on re-runs; we only care that login works afterward
curl -s -o /dev/null -w "  signup attempt: HTTP %{http_code}\n" \
  -X POST "$API/auth/signup" -H "Content-Type: application/json" \
  -d '{"email":"demo@a-idol.dev","password":"password123","nickname":"demo","birthdate":"2000-01-01"}'

USER_ACCESS=$(curl -fsS -X POST "$API/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"demo@a-idol.dev","password":"password123"}' | json_field accessToken)
test -n "$USER_ACCESS" || fail "user login returned empty token"
pass "POST /api/v1/auth/login"
curl -fsS "$API/me" -H "Authorization: Bearer $USER_ACCESS" >/dev/null && pass "GET /api/v1/me"

# ── 3. Admin auth + /me ──────────────────────────────────────────
step "admin identity"
ADMIN=$(curl -fsS -X POST "$API/admin/auth/login" -H "Content-Type: application/json" \
  -d '{"email":"admin@a-idol.dev","password":"admin-dev-0000"}' | json_field accessToken)
test -n "$ADMIN" || fail "admin login returned empty token"
pass "POST /api/v1/admin/auth/login"
curl -fsS "$API/admin/me" -H "Authorization: Bearer $ADMIN" >/dev/null && pass "GET /api/v1/admin/me"
probe "user token rejected on /admin/me" 401 "$API/admin/me" -H "Authorization: Bearer $USER_ACCESS"

# ── 4. Catalog (public) ──────────────────────────────────────────
step "catalog"
IDOL_ID=$(curl -fsS "$API/idols?size=1" | json_field 'items[0].id')
test -n "$IDOL_ID" || fail "catalog returned no idols (did you run \`make seed\`?)"
pass "GET /api/v1/idols → picked $IDOL_ID"

# ── 5. Fandom (heart + follow + fan-club join) ───────────────────
step "fandom"
curl -fsS -X POST "$API/idols/$IDOL_ID/heart" -H "Authorization: Bearer $USER_ACCESS" >/dev/null \
  && pass "heart (idempotent POST)"
curl -fsS -X POST "$API/idols/$IDOL_ID/follow" -H "Authorization: Bearer $USER_ACCESS" >/dev/null \
  && pass "follow (idempotent POST)"
curl -fsS -X POST "$API/idols/$IDOL_ID/fan-club/join" -H "Authorization: Bearer $USER_ACCESS" >/dev/null \
  && pass "fan-club join"

# ── 6. Chat — open + send + history ─────────────────────────────
step "chat"
ROOM_ID=$(curl -fsS -X POST "$API/chat/rooms/$IDOL_ID/open" -H "Authorization: Bearer $USER_ACCESS" | json_field id)
test -n "$ROOM_ID" || fail "chat room open returned no id"
pass "POST /api/v1/chat/rooms/:idolId/open → $ROOM_ID"

curl -fsS -X POST "$API/chat/rooms/$ROOM_ID/messages" -H "Authorization: Bearer $USER_ACCESS" \
  -H "Content-Type: application/json" -d '{"content":"smoke test message"}' >/dev/null \
  && pass "POST /api/v1/chat/rooms/:roomId/messages"

MSG_COUNT=$(curl -fsS "$API/chat/rooms/$ROOM_ID/messages?take=5" -H "Authorization: Bearer $USER_ACCESS" \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).length))")
test "$MSG_COUNT" -ge 2 || fail "expected at least 2 messages (user + idol reply), got $MSG_COUNT"
pass "GET /api/v1/chat/rooms/:roomId/messages (count=$MSG_COUNT)"

# ── 7. Chat balance (quota + coupon wallet) ─────────────────────
step "chat balance"
BAL_JSON=$(curl -fsS "$API/me/chat-balance" -H "Authorization: Bearer $USER_ACCESS")
REMAINING=$(echo "$BAL_JSON" | json_field remainingFreeMessages)
COUPONS=$(echo "$BAL_JSON" | json_field couponBalance)
pass "GET /api/v1/me/chat-balance (free=$REMAINING coupons=$COUPONS)"

# ── 8. Auto-message — schedule + cancel ─────────────────────────
step "auto-message"
FUTURE=$(node -e "console.log(new Date(Date.now()+600000).toISOString())")
TEMPLATE=$(curl -fsS -X POST "$API/admin/chat/auto-messages" -H "Authorization: Bearer $ADMIN" \
  -H "Content-Type: application/json" \
  -d "{\"idolId\":\"$IDOL_ID\",\"title\":\"smoke\",\"content\":\"smoke-test auto-message\",\"scheduledAt\":\"$FUTURE\"}")
TEMPLATE_ID=$(echo "$TEMPLATE" | json_field id)
test -n "$TEMPLATE_ID" || fail "schedule auto-message returned no id"
pass "POST /api/v1/admin/chat/auto-messages → SCHEDULED ($TEMPLATE_ID)"

curl -fsS -X DELETE "$API/admin/chat/auto-messages/$TEMPLATE_ID" -H "Authorization: Bearer $ADMIN" >/dev/null \
  && pass "DELETE /api/v1/admin/chat/auto-messages/:id (cancel before dispatch)"

printf "\n\033[32m✅ all smoke checks passed\033[0m\n"
