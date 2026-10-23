@echo off
:: Genere le .aab SIGNE pret a uploader sur le Play Store, en une commande.
:: Build shared + frontend, sync Capacitor, puis gradlew bundleRelease.
::
:: VITE_SERVER_URL pointe sur le backend de PROD par defaut (un .aab part toujours
:: pour le store). Pour viser un autre backend : set VITE_SERVER_URL=... avant.
:: versionName = fichier VERSION (la question posee plus bas peut le monter), versionCode = nb de commits (cf scripts/app-version.mjs).
:: ATTENTION : jette les modifs locales non commitees (git reset --hard) puis pull.
:: Chemin absolu du script capture AVANT le cd (%~f0 apres un cd peut se resoudre
:: depuis le nouveau dossier si le script a ete lance avec un chemin relatif).
set "SELF=%~f0"
cd /d "%~dp0.."

:: Bloc parse d'un coup par cmd : si le pull modifie ce .bat, on se relance sur la
:: nouvelle version au lieu de continuer a lire l'ancien fichier par offset.
if not "%~1"=="--synced" (
  echo Recuperation de origin ^(fetch + reset des modifs locales + pull^)...
  git fetch origin || exit /b 1
  git reset --hard || exit /b 1
  git pull || exit /b 1
  call "%SELF%" --synced
  exit /b
)

if "%VITE_SERVER_URL%"=="" (
  set VITE_SERVER_URL=https://onskone.fr
)

:: Build natif : base d'assets relative (cf vite.config.ts).
set CAPACITOR_BUILD=1

:: Quelle version store publier ? (garder / monter / saisir ; commit + push si elle change)
node "%~dp0release-version-prompt.mjs" || exit /b 1

:: Version calculee une seule fois (source de verite), injectee a Gradle via -P.
for /f "delims=" %%i in ('node "%~dp0app-version.mjs"') do set APP_VNAME=%%i
for /f "delims=" %%i in ('node "%~dp0app-version.mjs" --code') do set APP_VCODE=%%i
echo Version %APP_VNAME% (code %APP_VCODE%)

:: Cle RevenueCat Google : sans elle les achats sont morts dans l'AAB (cf check-rc-key).
node "%~dp0check-rc-key.mjs" android || exit /b 1

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
set AAB_DIR=%CD%\app\build\outputs\bundle\release
set AAB_PATH=%AAB_DIR%\app-release.aab

echo.
echo ============================================================
echo  .aab pret a uploader sur la Play Console (v%APP_VNAME%, code %APP_VCODE%), dans le dossier :
echo  %AAB_DIR%
echo ============================================================
if exist "%AAB_PATH%" (
  echo  ^(fichier OK^)
) else (
  echo  [ATTENTION] fichier introuvable - le build a peut-etre echoue plus haut.
)
