#
# Start the image viewer API and the Vite dev client together (Windows).
#
# Usage:
#   start.cmd
#   $env:IMAGE_DIR = "C:\path\to\pictures"; start.cmd
#
# macOS/Linux equivalent: ./start.sh
#

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$ApiPort = 3001

function Info($msg) { Write-Host "[start] $msg" -ForegroundColor Blue }
function Fail($msg) { Write-Host "[start] $msg" -ForegroundColor Red; exit 1 }

# taskkill /T kills the whole tree (npm.cmd -> vite -> esbuild), plain Kill does not.
function Stop-Tree($proc) {
    if ($proc -and -not $proc.HasExited) {
        taskkill /PID $proc.Id /T /F 2>$null | Out-Null
    }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Fail 'Node.js is not installed.' }
if (-not (Test-Path 'node_modules')) { Fail 'Server dependencies are missing. Run: npm install' }
if (-not (Test-Path 'client\node_modules')) { Fail 'Client dependencies are missing. Run: npm --prefix client install' }

try {
    if (Get-NetTCPConnection -LocalPort $ApiPort -State Listen -ErrorAction SilentlyContinue) {
        Fail "Port $ApiPort is already in use. Find it with: netstat -ano | findstr `":$ApiPort`" then: taskkill /PID <pid> /F"
    }
} catch {
    # Get-NetTCPConnection is unavailable (pre-Win10); skip the pre-check.
}

Info "API -> http://localhost:$ApiPort"
$api = Start-Process -FilePath 'node' -ArgumentList 'server\index.js' -PassThru -NoNewWindow

$npm = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npm) { Stop-Tree $api; Fail 'npm was not found on PATH.' }

Info 'App -> http://localhost:5173'
$app = Start-Process -FilePath $npm -ArgumentList 'run', 'dev' -PassThru -NoNewWindow -WorkingDirectory 'client'

try {
    while ($true) {
        if ($api.HasExited -or $app.HasExited) {
            Info 'A process stopped; shutting down the other one.'
            exit 1
        }
        Start-Sleep -Seconds 1
    }
} finally {
    Stop-Tree $app
    Stop-Tree $api
}
