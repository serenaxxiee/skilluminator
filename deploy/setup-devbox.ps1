#Requires -RunAsAdministrator
<#
.SYNOPSIS
    Sets up the Skilluminator agent on a Microsoft Dev Box (Windows).
    Run this once after RDP-ing into the Dev Box.

.DESCRIPTION
    1. Installs Node.js LTS (if missing)
    2. Clones the skilluminator repo from GitHub
    3. Installs npm dependencies
    4. Installs Claude Code CLI
    5. Prompts for Claude auth
    6. Registers a scheduled task to run the loop on startup
    7. Starts the loop immediately

.USAGE
    Open PowerShell as Administrator on the Dev Box, then:
    irm https://raw.githubusercontent.com/serenaxxiee/skilluminator/master/deploy/setup-devbox.ps1 | iex

    Or copy this file to the Dev Box and run:
    .\setup-devbox.ps1
#>

$ErrorActionPreference = "Stop"

# ─── Configuration ─────────────────────────────────────────────────────────

$REPO_URL      = "https://github.com/serenaxxiee/skilluminator.git"
$INSTALL_DIR   = "C:\skilluminator"
$LOG_DIR       = "C:\skilluminator\logs"
$NODE_VERSION  = "22"  # LTS
$TASK_NAME     = "SkilluminatorLoop"

# ─── Helper ────────────────────────────────────────────────────────────────

function Write-Step { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }

# ─── 1. Install Node.js if missing ────────────────────────────────────────

Write-Step "Checking Node.js..."
$nodeInstalled = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeInstalled) {
    Write-Step "Installing Node.js $NODE_VERSION LTS via winget..."
    winget install OpenJS.NodeJS.LTS --version $NODE_VERSION --accept-package-agreements --accept-source-agreements
    # Refresh PATH for this session
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
} else {
    Write-Host "  Node.js $(node --version) already installed."
}

# Verify npm is available
$npmInstalled = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmInstalled) {
    Write-Host "ERROR: npm not found after Node.js install. Restart PowerShell and re-run." -ForegroundColor Red
    exit 1
}

# ─── 2. Install Claude Code CLI ────────────────────────────────────────────

Write-Step "Checking Claude Code CLI..."
$claudeInstalled = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeInstalled) {
    Write-Step "Installing Claude Code CLI..."
    npm install -g @anthropic-ai/claude-code
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

$claudeInstalled = Get-Command claude -ErrorAction SilentlyContinue
if (-not $claudeInstalled) {
    Write-Host "ERROR: claude CLI not found after install. Check npm global bin is in PATH." -ForegroundColor Red
    exit 1
}
Write-Host "  Claude Code CLI ready: $(claude --version)"

# ─── 3. Clone or update the repo ──────────────────────────────────────────

Write-Step "Setting up repository..."
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Host "  Repo exists, pulling latest..."
    Push-Location $INSTALL_DIR
    git pull origin master
    Pop-Location
} else {
    if (Test-Path $INSTALL_DIR) {
        Remove-Item $INSTALL_DIR -Recurse -Force
    }
    git clone $REPO_URL $INSTALL_DIR
}

# ─── 4. Install npm dependencies ──────────────────────────────────────────

Write-Step "Installing npm dependencies..."
Push-Location $INSTALL_DIR
npm install
Pop-Location

# ─── 5. Verify TypeScript compiles ────────────────────────────────────────

Write-Step "Verifying TypeScript build..."
Push-Location $INSTALL_DIR
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: TypeScript compilation failed. Fix errors before continuing." -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Build: PASS"
Pop-Location

# ─── 6. Authenticate Claude Code ──────────────────────────────────────────

Write-Step "Authenticating Claude Code..."
Write-Host "  If not already logged in, a browser window will open."
Write-Host "  Complete the login, then return here."
Write-Host ""
claude auth login
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Claude auth may have failed. The loop will retry on each cycle." -ForegroundColor Yellow
}

# ─── 7. Create logs directory ──────────────────────────────────────────────

if (-not (Test-Path $LOG_DIR)) {
    New-Item -ItemType Directory -Path $LOG_DIR -Force | Out-Null
}

# ─── 8. Create the startup script ─────────────────────────────────────────

Write-Step "Creating launcher script..."
$launcherPath = "$INSTALL_DIR\deploy\run-loop.ps1"
$launcherContent = @'
# Skilluminator Loop Launcher
# This script is called by the scheduled task and runs indefinitely.

$ErrorActionPreference = "Continue"
$installDir = "C:\skilluminator"
$logFile = "C:\skilluminator\logs\loop-$(Get-Date -Format 'yyyy-MM-dd').log"

Set-Location $installDir

# Refresh PATH to pick up node/npm/claude
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")

Write-Output "$(Get-Date -Format o) Starting Skilluminator loop..." | Tee-Object -Append $logFile

# Run the loop — tsx handles TypeScript directly
npx tsx runner/loop.ts 2>&1 | Tee-Object -Append $logFile
'@
Set-Content -Path $launcherPath -Value $launcherContent -Encoding UTF8

# ─── 9. Register scheduled task (runs on logon, survives RDP disconnect) ──

Write-Step "Registering scheduled task '$TASK_NAME'..."

# Remove existing task if present
$existing = Get-ScheduledTask -TaskName $TASK_NAME -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:$false
}

$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$launcherPath`""

$trigger = New-ScheduledTaskTrigger -AtLogon

$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -RestartCount 3 `
    -ExecutionTimeLimit ([TimeSpan]::Zero)  # No time limit — runs forever

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -RunLevel Highest -LogonType Interactive

Register-ScheduledTask `
    -TaskName $TASK_NAME `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Skilluminator autonomous agent loop — runs continuously on login"

Write-Host "  Task registered: $TASK_NAME (runs at logon, no time limit)"

# ─── 10. Start the loop now ───────────────────────────────────────────────

Write-Step "Starting the Skilluminator loop..."
Start-ScheduledTask -TaskName $TASK_NAME

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Skilluminator is now running!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Install dir:  $INSTALL_DIR"
Write-Host "  Logs:         $LOG_DIR\loop-*.log"
Write-Host "  Task name:    $TASK_NAME"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  View logs:      Get-Content $LOG_DIR\loop-$(Get-Date -Format 'yyyy-MM-dd').log -Tail 50 -Wait"
Write-Host "  Stop loop:      Stop-ScheduledTask -TaskName $TASK_NAME"
Write-Host "  Start loop:     Start-ScheduledTask -TaskName $TASK_NAME"
Write-Host "  Check status:   Get-ScheduledTask -TaskName $TASK_NAME | Select State"
Write-Host "  Uninstall:      Unregister-ScheduledTask -TaskName $TASK_NAME -Confirm:`$false"
Write-Host ""
