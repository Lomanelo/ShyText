@echo off
REM Hotspot: Phone A = hotspot, PC + Phone B = clients (LAN QR will fail).
REM Expo appends :8081 to bare https hosts — always use :443 for Cloudflare.

cd /d "%~dp0.."

echo Stopping old cloudflared...
taskkill /F /IM cloudflared.exe >nul 2>&1

echo Make sure Metro is on 8081:  npx expo start --dev-client --port 8081
echo.
echo When the tunnel URL appears, enter it in ShyText WITH :443
echo   https://YOUR-SUBDOMAIN.trycloudflare.com:443
echo.
"C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:8081
