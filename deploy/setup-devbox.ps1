<#
.SYNOPSIS
    Sets up the Skilluminator agent on a Microsoft Dev Box (Windows).
    No admin privileges required. Does NOT auto-start anything.

.DESCRIPTION
    1. Checks that Node.js and git are available (tells you how to install if not)
    2. Clones the skilluminator repo
    3. Installs npm dependencies
    4. Installs Claude Code CLI
    5. Verifies the build
    6. Tells you how to authenticate and start the loop yourself

.USAGE
    .\setup-devbox.ps1
#>

$ErrorActionPreference = "Stop"

# ─── Configuration ─────────────────────────────────────────────────────────

$REPO_URL    = "https://github.com/serenaxxiee/skilluminator.git"
$INSTALL_DIR = "$HOME\skilluminator"

# ─── Helper ────────────────────────────────────────────────────────────────

function Write-Step { param([string]$msg) Write-Host "`n==> $msg" -ForegroundColor Cyan }

# ─── 1. Check prerequisites (don't install anything silently) ─────────────

Write-Step "Checking prerequisites..."

$missing = @()

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $missing += "Node.js - install via: winget install OpenJS.NodeJS.LTS"
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    $missing += "Git - install via: winget install Git.Git"
}

if ($missing.Count -gt 0) {
    Write-Host "Missing required tools:" -ForegroundColor Red
    foreach ($m in $missing) {
        Write-Host "  - $m" -ForegroundColor Yellow
    }
    Write-Host "`nInstall them and re-run this script."
    exit 1
}

Write-Host "  Node.js $(node --version) - OK"
Write-Host "  Git $(git --version) - OK"

# ─── 2. Clone or update the repo ──────────────────────────────────────────

Write-Step "Setting up repository at $INSTALL_DIR..."

if (Test-Path "$INSTALL_DIR\.git") {
    Write-Host "  Repo exists, pulling latest..."
    Push-Location $INSTALL_DIR
    git pull origin master
    Pop-Location
} else {
    git clone $REPO_URL $INSTALL_DIR
}

# ─── 3. Install npm dependencies ──────────────────────────────────────────

Write-Step "Installing npm dependencies..."
Push-Location $INSTALL_DIR
npm install
Pop-Location

# ─── 4. Install Claude Code CLI (user-level, no admin) ────────────────────

Write-Step "Checking Claude Code CLI..."
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "  Installing Claude Code CLI (npm global)..."
    npm install -g @anthropic-ai/claude-code
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
}

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Host "WARNING: claude not found in PATH. You may need to restart your terminal." -ForegroundColor Yellow
} else {
    Write-Host "  Claude Code CLI ready."
}

# ─── 5. Verify TypeScript compiles ────────────────────────────────────────

Write-Step "Verifying TypeScript build..."
Push-Location $INSTALL_DIR
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: TypeScript compilation failed." -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "  Build: PASS"
Pop-Location

# ─── 6. Create logs directory ─────────────────────────────────────────────

$logDir = "$INSTALL_DIR\logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

# ─── Done — tell the user what to do next ─────────────────────────────────

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host " Setup complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Authenticate Claude Code (one-time):"
Write-Host "     claude auth login"
Write-Host ""
Write-Host "  2. Start the loop in a visible window:"
Write-Host "     cd $INSTALL_DIR"
Write-Host "     npm run loop"
Write-Host ""
Write-Host "  3. Or start it in the background (survives RDP disconnect):"
Write-Host "     cd $INSTALL_DIR"
Write-Host "     .\deploy\start-background.ps1"
Write-Host ""
Write-Host "  4. View logs:"
Write-Host "     Get-Content $logDir\loop-*.log -Tail 50 -Wait"
Write-Host ""
