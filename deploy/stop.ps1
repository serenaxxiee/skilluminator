<#
.SYNOPSIS
    Stops the Skilluminator loop if it's running.
#>

$procs = Get-Process -Name "node" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*runner/loop*" -or $_.CommandLine -like "*runner\\loop*" }

if (-not $procs) {
    Write-Host "No Skilluminator loop process found." -ForegroundColor Yellow
    exit 0
}

foreach ($p in $procs) {
    Write-Host "Stopping PID $($p.Id)..." -ForegroundColor Cyan
    Stop-Process -Id $p.Id -Force
}

Write-Host "Skilluminator loop stopped." -ForegroundColor Green
