#!/usr/bin/env bash
# Build FINAL de l'app (ce qui partira sur le store) : bundle statique embarque,
# PLUS de live reload. Ouvre ensuite Android Studio pour lancer / generer l'APK.
#
# IMPORTANT : defini VITE_SERVER_URL avant de lancer, ex :
#   VITE_SERVER_URL=https://ton-domaine.com ./scripts/build-mobile.sh   (prod)
#   VITE_SERVER_URL=http://192.168.1.10:8080 ./scripts/build-mobile.sh  (PC local)
# Sans ca, l'app ne pourra pas joindre le backend (elle pointerait sur elle-meme).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Build natif : base d'assets relative (cf vite.config.ts).
export CAPACITOR_BUILD=1

if [ -z "$VITE_SERVER_URL" ]; then
  echo "[ATTENTION] VITE_SERVER_URL non defini : l'app ne pourra pas joindre le backend."
  sleep 3
fi

echo "[shared]   build..."
(cd "$ROOT/shared" && pnpm run build)

echo "[frontend] build (VITE_SERVER_URL=$VITE_SERVER_URL)..."
(cd "$ROOT/frontend" && pnpm run build)

echo "[mobile]   cap sync android..."
(cd "$ROOT/frontend" && pnpm exec cap sync android)

echo "[mobile]   ouverture Android Studio..."
(cd "$ROOT/frontend" && pnpm exec cap open android)
