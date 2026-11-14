@echo off
set "PATH=C:\Program Files\nodejs;%PATH%"
cd /d "%~dp0"
echo Building and launching Tank 3D Production PWA...
call npm run build
call npm run preview -- --open
pause
