@echo off
:: Build initial du package shared (types/constantes partagés)
:: La fenêtre de lancement se ferme ensuite, seuls back + front restent ouverts.
echo Building shared package...
cd shared
call pnpm run build
cd ..

:: Démarrage du backend
echo Starting backend server...
start "Onskone backend" cmd /k "cd backend && pnpm run dev"

:: Démarrage du frontend
echo Starting frontend server...
start "Onskone frontend" cmd /k "cd frontend && pnpm run dev --host"

echo Backend + frontend lancés. Fermeture du launcher.
