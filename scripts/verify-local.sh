#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE="${1:-full}"

run_backend() {
  echo "[backend] tests"
  (
    cd "$ROOT_DIR/backend"
    ./gradlew test
  )
}

run_frontend_typecheck() {
  echo "[frontend] typecheck"
  (
    cd "$ROOT_DIR/frontend"
    npm run typecheck
  )
}

run_frontend_build() {
  echo "[frontend] build"
  (
    cd "$ROOT_DIR/frontend"
    npm run build
  )
}

run_guardrails() {
  echo "[repo] size guardrails"
  "$ROOT_DIR/scripts/check-size-guardrails.sh"
}

case "$PROFILE" in
  full)
    run_backend
    run_frontend_typecheck
    run_frontend_build
    run_guardrails
    ;;
  frontend)
    run_frontend_typecheck
    run_frontend_build
    ;;
  backend)
    run_backend
    ;;
  guardrails)
    run_guardrails
    ;;
  *)
    echo "Usage: ./scripts/verify-local.sh [full|frontend|backend|guardrails]" >&2
    exit 1
    ;;
esac

echo "verify-local complete: ${PROFILE}"
