#!/usr/bin/env bash
# Genere le .aab SIGNE pret a uploader sur le Play Store, en une commande.
# Build shared + frontend, sync Capacitor, puis gradlew bundleRelease.
#
# VITE_SERVER_URL pointe sur le backend de PROD par defaut (un .aab part toujours
# pour le store). Pour viser un autre backend :
#   VITE_SERVER_URL=http://192.168.1.10:8080 ./scripts/release-aab.sh
# Le versionCode/versionName sont derives des tags/commits git (cf build.gradle).
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export VITE_SERVER_URL="${VITE_SERVER_URL:-https://onskone.fr}"
# Build natif : base d'assets relative (cf vite.config.ts).
export CAPACITOR_BUILD=1

# Version calculee une seule fois (source de verite), injectee a Gradle via -P.
VNAME="$(node "$ROOT/scripts/app-version.mjs")"
VCODE="$(node "$ROOT/scripts/app-version.mjs" --code)"
echo "[version]  $VNAME (code $VCODE)"

echo "[shared]   build..."
(cd "$ROOT/shared" && pnpm run build)

echo "[frontend] build (VITE_SERVER_URL=$VITE_SERVER_URL)..."
(cd "$ROOT/frontend" && pnpm run build)

echo "[mobile]   cap sync android..."
(cd "$ROOT/frontend" && pnpm exec cap sync android)

echo "[mobile]   gradlew bundleRelease..."
(cd "$ROOT/frontend/android" && ./gradlew bundleRelease -PappVersionName="$VNAME" -PappVersionCode="$VCODE")

echo ""
echo "============================================================"
echo " .aab pret a uploader :"
echo " frontend/android/app/build/outputs/bundle/release/app-release.aab"
echo "============================================================"
