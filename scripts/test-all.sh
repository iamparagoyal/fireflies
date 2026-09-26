#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Backend: pytest"
(cd "$ROOT/backend" && uv run pytest -q)

echo "==> Frontend: typecheck"
(cd "$ROOT/frontend" && npx next typegen >/dev/null && npm run --silent typecheck)

echo "==> Frontend: lint"
(cd "$ROOT/frontend" && npm run --silent lint)

echo "==> Frontend: unit & component tests"
(cd "$ROOT/frontend" && npm run --silent test)

if [[ "${SKIP_E2E:-}" != "1" ]]; then
  echo "==> End-to-end: Playwright"
  (cd "$ROOT/frontend" && npm run --silent test:e2e)
fi

echo "All tests passed."
