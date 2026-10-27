@echo off
setlocal
cd /d "%~dp0"
where git >nul 2>nul
if errorlevel 1 (
  echo Please install Git for Windows or GitHub Desktop first.
  echo https://git-scm.com/downloads/win
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Publish-To-GitHub.ps1"
if errorlevel 1 (
 echo GitHub publication could not finish. See error above.
 pause
 exit /b 1
)
pause
