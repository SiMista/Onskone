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

:: Ouverture du Studio et de l'Admin dans le navigateur (après démarrage du frontend)
timeout /t 5 /nobreak >nul
echo Ouverture de Onskone Studio...
start "" http://localhost:3000/studio
echo Ouverture de Onskone Admin...
start "" http://localhost:3000/admin

echo.
echo ====================================================
echo  Onskone est lance ! Adresses disponibles :
echo ====================================================
echo  Frontend : http://localhost:3000
echo  Studio   : http://localhost:3000/studio
echo  Admin    : http://localhost:3000/admin
echo  Backend  : http://localhost:8080
echo ====================================================
echo.
echo Fermeture du launcher.
timeout /t 3 /nobreak >nul
