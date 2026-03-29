#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

frontend_limit=800
backend_limit=1200

frontend_matches=0
backend_matches=0

list_repo_files() {
  git -C "$ROOT_DIR" ls-files --cached --others --exclude-standard
}

echo "Checking frontend .vue/.ts files > ${frontend_limit} lines"
while IFS= read -r file; do
  [ -f "$file" ] || continue
  lines="$(wc -l < "$file" | tr -d ' ')"
  if [ "$lines" -gt "$frontend_limit" ]; then
    printf 'FRONTEND %5s %s\n' "$lines" "${file#$ROOT_DIR/}"
    frontend_matches=$((frontend_matches + 1))
  fi
done < <(
  list_repo_files \
    | rg '^frontend/.*\.(vue|ts)$' \
    | rg -v '^(frontend/node_modules|frontend/\.nuxt|frontend/\.output)/' \
    | sed "s#^#$ROOT_DIR/#" \
    | sort
)

echo
echo "Checking backend .java files > ${backend_limit} lines"
while IFS= read -r file; do
  [ -f "$file" ] || continue
  lines="$(wc -l < "$file" | tr -d ' ')"
  if [ "$lines" -gt "$backend_limit" ]; then
    printf 'BACKEND  %5s %s\n' "$lines" "${file#$ROOT_DIR/}"
    backend_matches=$((backend_matches + 1))
  fi
done < <(
  list_repo_files \
    | rg '^backend/.*\.java$' \
    | sed "s#^#$ROOT_DIR/#" \
    | sort
)

echo
echo "Summary: frontend_over_limit=${frontend_matches} backend_over_limit=${backend_matches}"
