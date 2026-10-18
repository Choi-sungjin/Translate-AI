@echo off
setlocal
cd /d "%~dp0"
echo Translate AI - restart and version check
powershell.exe -NoProfile -File "%~dp0scripts\restart-bridge.ps1"
set "translateAiExit=%errorlevel%"
if not "%translateAiExit%"=="0" (
  echo.
  echo RESTART FAILED. Keep this window open and share the error message.
) else (
  echo.
  echo Restart finished. You can close this window and return to the NVIDIA page.
)
pause
exit /b %translateAiExit%
