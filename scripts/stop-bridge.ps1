$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $env:LOCALAPPDATA 'Translate-AI\bridge.pid'
if (-not (Test-Path -LiteralPath $pidFile)) { Write-Output 'No launcher-owned bridge process was recorded.'; return }
$bridgePid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$bridgeProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $bridgePid" -ErrorAction SilentlyContinue
$expectedScript = Join-Path $projectDir 'bridge\server.mjs'
if (-not $bridgeProcess) { Write-Output 'The bridge has already stopped.'; return }
if ($bridgeProcess.Name -ne 'node.exe' -or -not $bridgeProcess.CommandLine.Contains($expectedScript)) { throw 'Process identity changed; no process was stopped.' }
Stop-Process -Id $bridgePid -ErrorAction Stop -PassThru | Wait-Process -Timeout 5
Write-Output 'Translate AI bridge stopped.'
