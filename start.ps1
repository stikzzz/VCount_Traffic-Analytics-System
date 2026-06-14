# Traffic Analytics Startup Script

$host.ui.RawUI.WindowTitle = "Traffic Analytics Control Center"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "🚀 Starting Traffic Analytics Platform..." -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = Get-Location

# 1. Start Flask Backend
Write-Host "[1/2] Launching Flask Backend (Conda Environment: FYPAI)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\backend'; & 'D:\miniforge\shell\condabin\conda-hook.ps1'; conda activate FYPAI; python app.py"

# 2. Start Next.js Frontend
Write-Host "[2/2] Launching Next.js Frontend (npm run dev)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$ProjectRoot\frontend'; npm run dev"

Write-Host ""
Write-Host "✅ Both services launched in separate windows!" -ForegroundColor Green
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
