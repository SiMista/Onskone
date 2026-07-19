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

# node/pnpm/pm2 sont installés via nvm sur ce serveur ; le shell non-interactif
# de la CD ne source pas nvm -> `node: command not found`. On charge nvm si
# présent, sinon on ajoute au PATH le bin de la version node installée la plus
# récente. Insensible au numéro de version (survit à un upgrade node).
if ! command -v node > /dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    # shellcheck disable=SC1091
    . "$NVM_DIR/nvm.sh"
  fi
  if ! command -v node > /dev/null 2>&1; then
    NODE_BIN="$(ls -d "$NVM_DIR"/versions/node/*/bin 2>/dev/null | sort -V | tail -1)"
    [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
  fi
fi

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
# Affiche la version qui sera buildee : une regression silencieuse (ex: VERSION non
# bumpe) saute aux yeux ici plutot que de se decouvrir sur le store.
echo "==> Version: $(node scripts/app-version.mjs 2>/dev/null || echo '?') (code $(node scripts/app-version.mjs --code 2>/dev/null || echo '?'))"

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
