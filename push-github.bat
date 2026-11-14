@echo off
set "PATH=C:\Program Files\Git\cmd;%PATH%"
cd /d "%~dp0"
echo Pushing Tank 3D PWA (main) to GitHub...
git push -u origin main
echo.
echo GitHub Actions status: https://github.com/amonguslev/tank3d/actions
echo Live GitHub Pages URL: https://amonguslev.github.io/tank3d/
pause
