@echo off
setlocal
powershell.exe -NoProfile -File "%~dp0scripts\stop-bridge.ps1"
if errorlevel 1 pause
