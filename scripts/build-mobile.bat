@echo off
:: Build FINAL de l'app (ce qui partira sur le store) : bundle statique embarque,
:: PLUS de live reload. Ouvre ensuite Android Studio pour lancer / generer l'APK.
::
:: IMPORTANT : l'app embarquee doit savoir ou joindre le backend. Defini
:: VITE_SERVER_URL avant de lancer ce script, ex :
::   set VITE_SERVER_URL=https://ton-domaine.com   (backend de prod)
::   set VITE_SERVER_URL=http://192.168.1.10:8080   (ton PC, pour tester en local)
:: Sans ca, l'app ne pourra pas se connecter (elle pointerait sur elle-meme).
cd /d "%~dp0.."

if "%VITE_SERVER_URL%"=="" (
  echo.
  echo [ATTENTION] VITE_SERVER_URL n'est pas defini : l'app ne pourra pas
  echo joindre le backend. Defini-le puis relance, ou continue pour un test UI seul.
  echo.
  timeout /t 4 /nobreak >nul
)

:: Build natif : base d'assets relative (cf vite.config.ts).
set CAPACITOR_BUILD=1

echo Building shared package...
call pnpm build:shared

echo Building frontend (VITE_SERVER_URL=%VITE_SERVER_URL%)...
call pnpm build:frontend

echo Synchronisation Capacitor (copie du build dans android)...
cd frontend
call pnpm exec cap sync android

echo Ouverture d'Android Studio...
call pnpm exec cap open android
