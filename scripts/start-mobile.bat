@echo off
:: Lance l'app Android en LIVE RELOAD : le tel charge le serveur Vite du PC,
:: donc tu codes et l'app se rafraichit comme dans le navigateur.
:: Prerequis : Android Studio (SDK + adb) installe, un tel branche en USB
:: (debogage active) ou un emulateur ouvert, et le tel sur le MEME wifi que le PC.
cd /d "%~dp0.."

:: IP locale du PC sur le reseau (pour que le tel joigne Vite ET le backend).
for /f "delims=" %%i in ('node "%~dp0lan-ip.mjs"') do set LAN_IP=%%i
echo IP locale detectee : %LAN_IP%

echo Building shared package...
cd shared
call pnpm run build
cd ..

echo Starting backend server...
start "Onskone backend" cmd /k "cd backend && pnpm run dev"

:: VITE_SERVER_URL force la socket a viser le backend du PC (marche quel que soit le sous-reseau).
echo Starting frontend server (host mode)...
start "Onskone frontend" cmd /k "set VITE_SERVER_URL=http://%LAN_IP%:8080&& cd frontend && pnpm run dev --host"

echo Attente du demarrage des serveurs...
timeout /t 6 /nobreak >nul

echo Deploiement de l'app sur le device (live reload)...
cd frontend
call pnpm exec cap run android --live-reload --host %LAN_IP% --port 3000
