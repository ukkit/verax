#!/usr/bin/env bash
# Smoke test a running deployment (Cloudflare Pages, Vercel or the local server).
#   scripts/smoke.sh https://your-site.pages.dev
#   scripts/smoke.sh http://127.0.0.1:8787
# If the site sits behind a gate, pass credentials: SMOKE_AUTH='user:pass' scripts/smoke.sh <url>
set -uo pipefail

base="${1:-}"
if [ -z "$base" ]; then echo "usage: scripts/smoke.sh <base-url>"; exit 2; fi
base="${base%/}"
auth=()
if [ -n "${SMOKE_AUTH:-}" ]; then auth=(-u "$SMOKE_AUTH"); fi

fail=0
check() { # name, expected, actual
  if [ "$2" = "$3" ]; then echo "  ok    $1"; else echo "  FAIL  $1 (expected $2, got $3)"; fail=1; fi
}
status() { curl -s -o /dev/null -w '%{http_code}' --max-time 20 "${auth[@]}" "$@"; }

echo "Smoke testing $base"
check "home page loads"                     200 "$(status "$base/")"
check "known fund returns 200"              200 "$(status "$base/api/funds/119551")"
check "NAV history returns 200"             200 "$(status "$base/api/nav/119551?page_size=1")"
check "search by ISIN returns 200"          200 "$(status "$base/api/funds/search?q=INF209KA12Z1")"
check "unknown api area is rejected"        400 "$(status "$base/api/evil/1")"
check "unknown query key is rejected"       400 "$(status "$base/api/funds/119551?debug=1")"

body="$(curl -s --max-time 20 "${auth[@]}" "$base/api/funds/119551")"
if echo "$body" | grep -q '"latest_nav"'; then echo "  ok    response contains latest_nav"; else echo "  FAIL  response missing latest_nav"; fail=1; fi

headers="$(curl -sI --max-time 20 "${auth[@]}" "$base/")"
if echo "$headers" | grep -qi '^content-security-policy:.*default-src'; then echo "  ok    CSP header present"; else echo "  FAIL  CSP header missing"; fail=1; fi

if [ "$fail" -eq 0 ]; then echo "All checks passed."; else echo "Some checks failed."; fi
exit "$fail"
