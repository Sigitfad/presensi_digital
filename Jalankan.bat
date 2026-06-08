@echo off
title Presensi SDN Karangpawitan 1
cd /d "%~dp0"

cls
echo.
echo  ================================================
echo   PRESENSI SDN KARANGPAWITAN 1 v2.2
echo  ================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo  ERROR: Node.js tidak terinstall!
    echo  Download di: https://nodejs.org
    echo.
    pause
    exit /b
)

if not exist "node_modules\.package-lock.json" (
    echo  Menginstall dependencies...
    npm install --no-audit --no-fund
    if %errorlevel% neq 0 (
        echo  GAGAL menginstall dependencies.
        echo  Coba klik kanan lalu pilih "Run as Administrator"
        echo.
        pause
        exit /b
    )
)

echo  Memulai server...
echo.
start "" http://localhost:3000
node server.js
pause
