@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo Starting Tank 3D PWA dev server...
npm run dev -- --open
pause
