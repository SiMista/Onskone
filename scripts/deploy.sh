#!/usr/bin/env bash
#
# Déploiement côté VPS (exécuté par la CD GitHub Actions, ou à la main).
# Hypothèses :
#   - Le code est déjà à jour (la CD fait `git reset --hard origin/main` avant).
#     En manuel : `git pull` d'abord, puis `bash scripts/deploy.sh`.
#   - Le backend tourne via tsx (PAS de build backend) ; shared + frontend sont
#     buildés ICI (sortie gitignorée, jamais committée).
#   - pm2 gère le process `onskone` (cf. ecosystem.config.cjs).
#
set -euo pipefail

# Le shell non-interactif de la CD ne source pas forcément ~/.profile : on
# rend pnpm/pm2 trouvables (adapter si installé ailleurs).
export PNPM_HOME="${PNPM_HOME:-$HOME/.local/share/pnpm}"
export PATH="$PNPM_HOME:$HOME/.npm-global/bin:$PATH"

cd "$(dirname "$0")/.."   # racine du repo
ROOT="$(pwd)"

# En mode manuel (hors CI), on se réaligne sur origin/main.
# Le VPS est un pur miroir de GitHub (aucun commit local à préserver) : on évite
# `git pull` (qui casse en erreur si un tag local diverge, ex. v1.3 réutilisé, et
# qui peut diverger après un force-push). On fetch en forçant les tags puis on
# reset dur sur origin/main -> déploiement déterministe, insensible aux tags.
if [ -z "${CI:-}" ]; then
  echo "==> Mise à jour du code (fetch + reset --hard origin/main)"
  git fetch --prune --tags --force origin
  git reset --hard origin/main
fi

echo "==> Déploiement depuis $ROOT (commit $(git rev-parse --short HEAD))"

echo "==> Installation des dépendances (recompile better-sqlite3 natif pour ce serveur)"
pnpm install --frozen-lockfile

echo "==> Build du package partagé (shared/dist)"
pnpm build:shared

echo "==> Build du frontend (frontend/build)"
pnpm build:frontend

echo "==> (Re)démarrage du backend via pm2"
if pm2 describe onskone > /dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

echo "==> Déploiement terminé ✅"
