# Registers the daily 9:00 AM BPLT Excel -> website sync (Windows Task Scheduler, current user).
# Usage:  powershell -File scheduling\register-excel-sync.ps1            (report-only, no writes)
#         powershell -File scheduling\register-excel-sync.ps1 -Apply     (updates the live site)
param([switch]$Apply)
$repo   = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python).Source
$script = Join-Path $repo 'scripts\excel_sync.py'
$argStr = "-I `"$script`"" + $(if ($Apply) { ' --apply' } else { '' })
$action   = New-ScheduledTaskAction -Execute $python -Argument $argStr -WorkingDirectory $repo
$trigger  = New-ScheduledTaskTrigger -Daily -At 9:00am
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'BPLT Excel Sync' -Action $action -Trigger $trigger -Settings $settings -Description 'BearPit point tracker (Box Excel) -> baylor-bearpit.web.app. Reports in sync-reports\' -Force | Out-Null
Write-Output ("Registered 'BPLT Excel Sync' daily 9:00 AM, mode: " + $(if ($Apply) { 'APPLY' } else { 'report only' }))
