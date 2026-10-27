@echo off
setlocal
cd /d "%~dp0"
title Absolute HbS Explorer - Windows Preview
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Please install the LTS version from https://nodejs.org/
  echo Then double-click this file again.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Reinstall Node.js LTS and reopen this file.
  pause
  exit /b 1
)
if not exist "node_modules\vite" (
  echo Installing dashboard dependencies (first launch only)...
  call npm install --no-audit --no-fund
  if errorlevel 1 (echo Dependency installation failed. & pause & exit /b 1)
)
echo.
echo Running Excel parser tests...
call npm test
if errorlevel 1 (echo Tests failed. Please report the output above. & pause & exit /b 1)
echo.
echo Starting the local dashboard. A browser tab should open automatically.
echo To stop the dashboard, return here and press Ctrl+C.
call npm run dev -- --open
if errorlevel 1 pause
endlocal
