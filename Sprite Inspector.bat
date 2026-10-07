@echo off
setlocal
cd /d "%~dp0"
start "Sprite Inspector" cmd /k "npm run dev:inspector"
endlocal
