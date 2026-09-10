#!/usr/bin/env bash
# Quality gate: señal objetiva para el code-review. Corre lint, type-check, tests y
# cobertura, y resume PASS/FAIL. No falla el shell si un paso falla: reporta el estado
# de cada uno para que la rúbrica lo use como evidencia.
set -uo pipefail

ROOT="${1:-.}"
cd "$ROOT"

run() { # <nombre> <comando...>
  local name="$1"; shift
  printf '\n=== %s ===\n' "$name"
  if "$@"; then
    printf '[%s] PASS\n' "$name"
    return 0
  else
    printf '[%s] FAIL (exit %s)\n' "$name" "$?"
    return 1
  fi
}

declare -A STATUS

run "eslint"      npx --no-install eslint "{src,apps,libs,test}/**/*.ts" && STATUS[eslint]=PASS || STATUS[eslint]=FAIL
run "typecheck"   npx --no-install tsc --noEmit && STATUS[typecheck]=PASS || STATUS[typecheck]=FAIL
run "tests+cov"   npx --no-install jest --coverage --coverageReporters=text-summary && STATUS[tests]=PASS || STATUS[tests]=FAIL

printf '\n===== QUALITY GATE SUMMARY =====\n'
for k in eslint typecheck tests; do
  printf '%-10s %s\n' "$k" "${STATUS[$k]:-SKIP}"
done
