@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "node_modules\@openai\codex\package.json" (
  call npm ci --omit=dev --ignore-scripts
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
powershell.exe -NoProfile -File "%~dp0scripts\start-bridge.ps1"
if errorlevel 1 pause
