$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $env:LOCALAPPDATA 'Translate-AI\bridge.pid'
$listenerPids = @(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 18458 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if ($listenerPids.Count -gt 1) { throw 'Multiple bridge listeners were found; no process was stopped.' }
if ($listenerPids.Count -eq 1) {
  $bridgePid = [int]$listenerPids[0]
  Write-Output "Found the loopback bridge listener (PID $bridgePid). Verifying its project path..."
} elseif (Test-Path -LiteralPath $pidFile) {
  $bridgePid = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
} else {
  Write-Output 'No bridge listener or recorded process was found.'
  return
}
$bridgeProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $bridgePid" -ErrorAction SilentlyContinue
$expectedScript = Join-Path $projectDir 'bridge\server.mjs'
if (-not $bridgeProcess) { Write-Output 'The bridge has already stopped.'; return }
$escapedScript = [regex]::Escape($expectedScript)
$scriptArgument = '(?:^|\s)(?:"' + $escapedScript + '"|' + $escapedScript + ')(?=\s|$)'
if ($bridgeProcess.Name -ne 'node.exe' -or $bridgeProcess.CommandLine -notmatch $scriptArgument) { throw 'Process identity changed; no process was stopped.' }
Stop-Process -Id $bridgePid -ErrorAction Stop -PassThru | Wait-Process -Timeout 5
Write-Output 'Translate AI bridge stopped.'
