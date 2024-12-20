@echo off
:: Démarrage du backend
echo Starting backend server...
start cmd /k "cd backend && npm start"

:: Démarrage du frontend
echo Starting frontend server...
start cmd /k "cd frontend && npm start"

echo All servers are starting. You can close this window.
pause
