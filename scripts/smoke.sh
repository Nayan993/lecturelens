#!/usr/bin/env bash
# End-to-end smoke test against a running, seeded API. Starts nothing itself.
# Usage: bash scripts/smoke.sh   (API_URL defaults to http://localhost:5000/api/v1)
set -uo pipefail
API="${API_URL:-http://localhost:5000/api/v1}"
BODY=$(mktemp); trap 'rm -f "$BODY"' EXIT
fail() { echo "FAIL: $*"; exit 1; }
json() { node -e "const j=JSON.parse(require('fs').readFileSync('$BODY','utf8'));console.log($1)"; }

# check <name> <expected status> <curl args…>: runs curl, saves the body, compares the status.
check() {
  local name=$1 want=$2; shift 2
  local got; got=$(curl -s -o "$BODY" -w '%{http_code}' "$@") || fail "$name: no response from $API"
  [ "$got" = "$want" ] || fail "$name: expected $want, got $got — $(head -c 300 "$BODY")"
  echo "ok   $want  $name"
}

check "GET /health" 200 "$API/health"
[ "$(json 'j.status')" = ok ] || fail "health status is not ok"
check "POST /auth/login (seeded teacher)" 200 -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' -d '{"email":"teacher@lecturelens.dev","password":"lecturelens"}'
AUTH="Authorization: Bearer $(json 'j.token')"
check "GET /lectures" 200 "$API/lectures" -H "$AUTH"
ID=$(json 'j.items[0]?.id ?? ""'); [ -n "$ID" ] || fail "no lectures — run: npm run seed --workspace server"
check "GET /lectures/$ID" 200 "$API/lectures/$ID" -H "$AUTH"
[ "$(json 'j.lecture.id')" = "$ID" ] || fail "lecture detail returned a different id"
check "GET /lectures/$ID/status" 200 "$API/lectures/$ID/status" -H "$AUTH"
[ "$(json 'j.stages.length')" = 6 ] || fail "status does not list six stages"
check "POST /ask (stub)" 501 -X POST "$API/ask" -H "$AUTH" \
  -H 'Content-Type: application/json' -d '{"question":"Why does the loss blow up?"}'
[ "$(json 'j.error.code')" = NOT_IMPLEMENTED ] || fail "501 without the NOT_IMPLEMENTED envelope"
echo "smoke: all checks passed"
