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

echo.
echo ============================================================
echo  .aab pret a uploader :
echo  frontend\android\app\build\outputs\bundle\release\app-release.aab
echo ============================================================
