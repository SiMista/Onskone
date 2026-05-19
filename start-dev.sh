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

# Ouverture du Studio et de l'Admin dans le navigateur (après démarrage du frontend)
(
  sleep 5
  if command -v xdg-open >/dev/null 2>&1; then
    opener="xdg-open"
  elif command -v open >/dev/null 2>&1; then
    opener="open"
  elif command -v start >/dev/null 2>&1; then
    opener="start"
  else
    opener=""
  fi
  if [ -n "$opener" ]; then
    echo "[launcher] Ouverture de Onskone Studio..."
    "$opener" http://localhost:3000/studio >/dev/null 2>&1 || true
    echo "[launcher] Ouverture de Onskone Admin..."
    "$opener" http://localhost:3000/admin >/dev/null 2>&1 || true
  fi
) &

wait
