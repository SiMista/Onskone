@echo off
:: Build initial du package shared (types/constantes partagés)
echo Building shared package...
cd shared
call pnpm run build
cd ..

:: Watch shared pour rebuild automatique en cas de modification
echo Starting shared watch...
start cmd /k "cd shared && pnpm run watch"

:: Démarrage du backend
echo Starting backend server...
start cmd /k "cd backend && pnpm run dev"

:: Démarrage du frontend
echo Starting frontend server...
start cmd /k "cd frontend && pnpm run dev --host"

echo All servers are starting. You can close this window.
pause
