$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$bridgeUrl = 'http://127.0.0.1:18458'
$alreadyRunning = $false
try {
  $health = Invoke-RestMethod -Uri "$bridgeUrl/health" -TimeoutSec 2
  if ($health.name -ne 'translate-ai-bridge') { throw 'Port 18458 belongs to another application.' }
  $alreadyRunning = $true
} catch {
  if ($_.Exception.Message -eq 'Port 18458 belongs to another application.') { throw }
}
if (-not $alreadyRunning) {
  $nodePath = (Get-Command node -ErrorAction Stop).Source
  $stateDir = Join-Path $env:LOCALAPPDATA 'Translate-AI'
  New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
  $serverFile = Join-Path $projectDir 'bridge\server.mjs'
  $bridgeProcess = Start-Process -FilePath $nodePath -ArgumentList ('"' + $serverFile + '"') -WorkingDirectory $projectDir -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir 'bridge.log') -RedirectStandardError (Join-Path $stateDir 'bridge-error.log')
  $bridgeProcess.Id | Set-Content -LiteralPath (Join-Path $stateDir 'bridge.pid')
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 200
    try { $health = Invoke-RestMethod -Uri "$bridgeUrl/health" -TimeoutSec 1; if ($health.name -eq 'translate-ai-bridge') { $alreadyRunning = $true; break } } catch { }
  }
  if (-not $alreadyRunning) { throw 'Translate AI bridge could not start. Check the local bridge-error.log.' }
}
Start-Process "$bridgeUrl/"
Write-Output 'Translate AI is ready. Pair the local code in extension settings. No OAuth tokens are copied.'
