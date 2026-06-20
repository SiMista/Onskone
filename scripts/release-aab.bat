@echo off
:: Genere le .aab SIGNE pret a uploader sur le Play Store, en une commande.
:: Build shared + frontend, sync Capacitor, puis gradlew bundleRelease.
::
:: VITE_SERVER_URL pointe sur le backend de PROD par defaut (un .aab part toujours
:: pour le store). Pour viser un autre backend : set VITE_SERVER_URL=... avant.
:: Le versionCode/versionName sont derives des tags/commits git (cf build.gradle).
cd /d "%~dp0.."

if "%VITE_SERVER_URL%"=="" (
  set VITE_SERVER_URL=https://onskone.fr
)

:: Build natif : base d'assets relative (cf vite.config.ts).
set CAPACITOR_BUILD=1

:: Version calculee une seule fois (source de verite), injectee a Gradle via -P.
for /f "delims=" %%i in ('node "%~dp0app-version.mjs"') do set APP_VNAME=%%i
for /f "delims=" %%i in ('node "%~dp0app-version.mjs" --code') do set APP_VCODE=%%i
echo Version %APP_VNAME% (code %APP_VCODE%)

echo Building shared package...
call pnpm build:shared || exit /b 1

echo Building frontend (VITE_SERVER_URL=%VITE_SERVER_URL%)...
call pnpm build:frontend || exit /b 1

echo Synchronisation Capacitor (copie du build dans android)...
cd frontend
call pnpm exec cap sync android || exit /b 1

echo Generation du bundle signe (gradlew bundleRelease)...
cd android
call gradlew.bat bundleRelease -PappVersionName=%APP_VNAME% -PappVersionCode=%APP_VCODE% || exit /b 1

:: Chemin absolu (on est dans frontend\android) pour copier-coller direct.
set AAB_PATH=%CD%\app\build\outputs\bundle\release\app-release.aab

echo.
echo ============================================================
echo  .aab pret a uploader sur la Play Console (v%APP_VNAME%, code %APP_VCODE%) :
echo  %AAB_PATH%
echo ============================================================
if exist "%AAB_PATH%" (
  echo  ^(fichier OK^)
) else (
  echo  [ATTENTION] fichier introuvable - le build a peut-etre echoue plus haut.
)
