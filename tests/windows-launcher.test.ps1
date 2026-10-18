# Uses command mocks only: never stops/starts a real process, opens a browser,
# contacts the bridge, or writes the user's application-data directory.
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $PSScriptRoot
$launcherDir = Join-Path $projectDir 'scripts'
$expectedVersion = (Get-Content -LiteralPath (Join-Path $projectDir 'extension\manifest.json') -Raw | ConvertFrom-Json).version
$newHealth = [pscustomobject]@{ name='translate-ai-bridge'; version=$expectedVersion; modelSelection=$true; active=0; queued=0 }
$oldHealth = [pscustomobject]@{ name='translate-ai-bridge'; version='1.2.0'; active=0; queued=0 }
$global:launcherTestState = $null
function Invoke-RestMethod {
  param($Uri, $TimeoutSec)
  $i = $global:launcherTestState.cursor; $global:launcherTestState.cursor++
  if ($i -ge $global:launcherTestState.health.Count -or $null -eq $global:launcherTestState.health[$i]) { throw 'Fixture: server offline' }
  return $global:launcherTestState.health[$i]
}
function Start-Process {
  param($FilePath, $ArgumentList, $WorkingDirectory, $WindowStyle, [switch]$PassThru, $RedirectStandardOutput, $RedirectStandardError)
  $global:launcherTestState.starts.Add([string]$FilePath)
  if ($PassThru) { return [pscustomobject]@{ Id=23456 } }
}
function Stop-Process {
  [CmdletBinding()] param($Id, [switch]$PassThru)
  $global:launcherTestState.stops.Add([int]$Id)
  if ($PassThru) { return [pscustomobject]@{ Id=$Id } }
}
function Wait-Process { param([Parameter(ValueFromPipeline=$true)]$InputObject, $Timeout) process { } }
function Start-Sleep { param($Milliseconds) }
function New-Item { param($ItemType, $Path, [switch]$Force) }
function Set-Content {
  param($LiteralPath, $Encoding, [Parameter(ValueFromPipeline=$true)]$Value)
  process { if ($LiteralPath -like '*restart-status.json') { $global:launcherTestState.status = $Value | ConvertFrom-Json } }
}
function Test-Path {
  param($LiteralPath)
  if ($LiteralPath -like '*bridge.pid') { return $global:launcherTestState.pidExists }
  return Microsoft.PowerShell.Management\Test-Path -LiteralPath $LiteralPath
}
function Get-Content {
  param($LiteralPath, [switch]$Raw)
  if ($LiteralPath -like '*bridge.pid') { return '23456' }
  return Microsoft.PowerShell.Management\Get-Content -LiteralPath $LiteralPath -Raw:$Raw
}
function Get-CimInstance {
  [CmdletBinding()] param($ClassName, $Filter)
  return [pscustomobject]@{ Name='node.exe'; CommandLine=$global:launcherTestState.command }
}
function Reset-Fixture($health) {
  $global:launcherTestState = @{ health=@($health); cursor=0; starts=[System.Collections.Generic.List[string]]::new(); stops=[System.Collections.Generic.List[int]]::new(); status=$null; pidExists=$true; command=(Join-Path $projectDir 'bridge\server.mjs') }
}
function Assert($condition, $message) { if (-not $condition) { throw "FAIL: $message" } }
function Expect-Failure($file, $pattern) {
  $failure = $null
  try { & (Join-Path $launcherDir $file) | Out-Null } catch { $failure = $_.Exception.Message }
  Assert ($failure -like $pattern) "Expected '$pattern', got '$failure'"
}

Reset-Fixture @($oldHealth)
Expect-Failure 'start-bridge.ps1' '*is still running*'
Assert ($global:launcherTestState.starts.Count -eq 0) 'Old bridge must not open the pairing dashboard or claim readiness'

Reset-Fixture @([pscustomobject]@{name='another-app'; version=$expectedVersion})
Expect-Failure 'start-bridge.ps1' '*another application*'
Assert ($global:launcherTestState.starts.Count -eq 0) 'Foreign listener must not be reused'

Reset-Fixture @($newHealth)
& (Join-Path $launcherDir 'start-bridge.ps1') | Out-Null
Assert ($global:launcherTestState.starts.Count -eq 1 -and $global:launcherTestState.starts[0] -eq 'http://127.0.0.1:18458/') 'Current bridge should open only its dashboard'

Reset-Fixture @([pscustomobject]@{name='translate-ai-bridge'; version='1.2.0'; active=1; queued=0})
Expect-Failure 'restart-bridge.ps1' '*still running*'
Assert ($global:launcherTestState.stops.Count -eq 0 -and $global:launcherTestState.starts.Count -eq 0) 'Busy bridge must not be interrupted'

Reset-Fixture @($oldHealth)
$global:launcherTestState.command = 'C:\another-project\bridge\server.mjs'
Expect-Failure 'restart-bridge.ps1' '*identity changed*'
Assert ($global:launcherTestState.stops.Count -eq 0) 'Unrelated PID must not be stopped'

Reset-Fixture @($oldHealth, $null, $newHealth, $newHealth)
& (Join-Path $launcherDir 'restart-bridge.ps1') | Out-Null
Assert ($global:launcherTestState.stops.Count -eq 1 -and $global:launcherTestState.stops[0] -eq 23456) 'Restart must stop only the fixture-owned PID'
Assert ($global:launcherTestState.starts.Count -eq 2 -and $global:launcherTestState.status.step -eq 'ready') 'Restart must launch, verify the new version, then record ready'

Reset-Fixture @($null, $null, $newHealth, $newHealth)
$global:launcherTestState.pidExists = $false
& (Join-Path $launcherDir 'restart-bridge.ps1') | Out-Null
Assert ($global:launcherTestState.stops.Count -eq 0 -and $global:launcherTestState.status.step -eq 'ready') 'No PID file must return to the restart caller and start normally'

Reset-Fixture @($oldHealth, $null, $oldHealth)
Expect-Failure 'restart-bridge.ps1' '*Unexpected bridge version*'
Assert ($global:launcherTestState.status.step -eq 'failed') 'Failed version check must be recorded, never ready'
Write-Output 'PASS: 8 Windows launcher scenarios (mocked process, network, browser, and app-data writes).'
