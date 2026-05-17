#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

cleanup() {
  echo ""
  echo "Arrêt des serveurs..."
  kill 0
}
trap cleanup INT TERM

# Build initial du package shared (synchrone, puis fermé - pas de watch)
echo "[shared]   build initial..."
(cd "$ROOT/shared" && pnpm run build)

# Seuls le backend et le frontend tournent ensuite, dans le terminal courant.
(cd "$ROOT/backend"  && pnpm run dev            2>&1 | sed -u 's/^/[backend]  /') &
(cd "$ROOT/frontend" && pnpm run dev --host     2>&1 | sed -u 's/^/[frontend] /') &

wait
