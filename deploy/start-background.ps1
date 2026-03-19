<#
.SYNOPSIS
    Starts the Skilluminator loop as a background job that survives RDP disconnect.
    No admin required. Uses Start-Process with -WindowStyle Minimized (visible in taskbar).

.DESCRIPTION
    Launches the loop in a separate PowerShell process. The process stays alive
    even after you disconnect RDP because it's a standalone process, not tied
    to your terminal session.

    Output goes to logs\loop-YYYY-MM-DD.log (daily rotation).

.USAGE
    cd ~\skilluminator
    .\deploy\start-background.ps1
#>

$ErrorActionPreference = "Stop"

$installDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$logDir = "$installDir\logs"
$logFile = "$logDir\loop-$(Get-Date -Format 'yyyy-MM-dd').log"

# Ensure logs directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# Check if already running
$existing = Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*runner/loop*" -or $_.CommandLine -like "*runner\\loop*" }
if ($existing) {
    Write-Host "Skilluminator loop is already running (PID: $($existing.Id))." -ForegroundColor Yellow
    Write-Host "Stop it first: Stop-Process -Id $($existing.Id)"
    exit 0
}

# Start the loop in a minimized (visible) window
Write-Host "Starting Skilluminator loop..." -ForegroundColor Cyan
Write-Host "  Log: $logFile"

$proc = Start-Process -FilePath "powershell.exe" `
    -ArgumentList "-NoProfile", "-Command", "Set-Location '$installDir'; npx tsx runner/loop.ts 2>&1 | Tee-Object -Append '$logFile'" `
    -WindowStyle Minimized `
    -PassThru

Write-Host "  PID: $($proc.Id)" -ForegroundColor Green
Write-Host ""
Write-Host "The loop is running in a minimized window (check your taskbar)."
Write-Host "It will keep running after you disconnect RDP."
Write-Host ""
Write-Host "Commands:"
Write-Host "  View logs:  Get-Content '$logFile' -Tail 50 -Wait"
Write-Host "  Stop:       Stop-Process -Id $($proc.Id)"
Write-Host ""
