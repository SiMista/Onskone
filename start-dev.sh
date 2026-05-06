#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Arrêt des serveurs..."
  kill 0
}
trap cleanup INT TERM

echo "[shared]    build initial..."
(cd "$ROOT/shared" && pnpm run build)

(cd "$ROOT/shared"   && pnpm run watch          2>&1 | sed -u 's/^/[shared]   /') &
(cd "$ROOT/backend"  && pnpm run dev            2>&1 | sed -u 's/^/[backend]  /') &
(cd "$ROOT/frontend" && pnpm run dev --host     2>&1 | sed -u 's/^/[frontend] /') &

wait
