@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Node.js/npm was not found. Install Node.js LTS and reopen this window.
  echo See README.md for setup instructions.
  pause
  exit /b 1
)
where cargo >nul 2>nul
if errorlevel 1 (
  echo Rust/cargo was not found. Install Rust 1.90+ and the C++ Build Tools.
  echo See README.md for setup instructions.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing project packages...
  call npm install
  if errorlevel 1 (pause & exit /b 1)
)
echo Launching Absolute HbS Explorer...
call npm run desktop:dev
if errorlevel 1 pause
endlocal
