$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $env:LOCALAPPDATA 'Translate-AI'
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
$statusFile = Join-Path $stateDir 'restart-status.json'
function Write-RestartStatus($step, $message) {
  [ordered]@{ time = (Get-Date).ToString('o'); step = $step; message = $message; project = $projectDir; stateDirectory = $stateDir } | ConvertTo-Json | Set-Content -LiteralPath $statusFile -Encoding UTF8
  Write-Output $message
}
try {
  Write-RestartStatus 'checking' "Checking Translate AI in $projectDir"
  $before = $null
  try { $before = Invoke-RestMethod -Uri 'http://127.0.0.1:18458/health' -TimeoutSec 2 } catch { }
  if ($before -and $before.name -ne 'translate-ai-bridge') { throw 'Port 18458 belongs to another application. Nothing was stopped.' }
  if ($before -and (($before.active -gt 0) -or ($before.queued -gt 0))) { throw 'Translations are still running. Wait for them to finish, then restart.' }
  Write-RestartStatus 'stopping' 'Finding and stopping the Translate AI bridge for this project...'
  & (Join-Path $PSScriptRoot 'stop-bridge.ps1')
  Write-RestartStatus 'starting' 'Starting the current version...'
  & (Join-Path $PSScriptRoot 'start-bridge.ps1')
  $after = Invoke-RestMethod -Uri 'http://127.0.0.1:18458/health' -TimeoutSec 3
  $expected = (Get-Content -LiteralPath (Join-Path $projectDir 'extension\manifest.json') -Raw | ConvertFrom-Json).version
  if ($after.name -ne 'translate-ai-bridge' -or $after.version -ne $expected -or -not $after.modelSelection) { throw 'Version/model-selection check failed. The restart was not successful.' }
  Write-RestartStatus 'ready' "READY: Translate AI bridge v$($after.version), model selection enabled."
} catch {
  Write-RestartStatus 'failed' $_.Exception.Message
  throw
}
