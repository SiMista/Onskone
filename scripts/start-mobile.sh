#!/usr/bin/env bash
# Lance l'app Android en LIVE RELOAD : le tel charge le serveur Vite du PC.
# Prerequis : Android Studio (SDK + adb), device branche (debug USB) ou emulateur,
# et le tel sur le MEME wifi que le PC.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# IP locale du PC sur le reseau (pour que le tel joigne Vite ET le backend).
LAN_IP=$(node "$(dirname "$0")/lan-ip.mjs")
echo "[mobile]   IP locale detectee : $LAN_IP"

cleanup() {
  echo ""
  echo "Arret des serveurs..."
  kill 0
}
trap cleanup INT TERM

echo "[shared]   build initial..."
(cd "$ROOT/shared" && pnpm run build)

rm -rf "$ROOT/frontend/node_modules/.vite"

(cd "$ROOT/backend"  && pnpm run dev        2>&1 | sed -u 's/^/[backend]  /') &
# VITE_SERVER_URL force la socket a viser le backend du PC (quel que soit le sous-reseau).
(cd "$ROOT/frontend" && VITE_SERVER_URL="http://$LAN_IP:8080" pnpm run dev --host 2>&1 | sed -u 's/^/[frontend] /') &

sleep 6
echo "[mobile]   deploiement sur le device (live reload)..."
(cd "$ROOT/frontend" && pnpm exec cap run android --live-reload --host "$LAN_IP" --port 3000)

wait
