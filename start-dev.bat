@echo off
:: Démarrage du backend
echo Starting backend server...
start cmd /k "cd backend && pnpm run dev"

:: Démarrage du frontend
echo Starting frontend server...
start cmd /k "cd frontend && pnpm run dev --host"

echo All servers are starting. You can close this window.
pause
