Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting EduFeedback AI System Servers    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Determine Local Network IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -notlike "255.*" } | Select-Object -First 1).IPAddress
if (-not $localIP) { $localIP = "127.0.0.1" }

# 1. Start the FastAPI Python Backend
Write-Host "[1/2] Launching FastAPI Backend on port 8000 (Exposed)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

# 2. Start the Vite React Frontend
Write-Host "[2/2] Launching React Dev Server on port 5173 (Exposed)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --host"

Write-Host "---------------------------------------------" -ForegroundColor Cyan
Write-Host "Local Machine Access:" -ForegroundColor Cyan
Write-Host "  FastAPI Swagger Docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  Student Feedback Portal: http://localhost:5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Local Network Access (For Friends):" -ForegroundColor Cyan
Write-Host "  FastAPI Swagger Docs: http://$($localIP):8000/docs" -ForegroundColor Yellow
Write-Host "  Student Feedback Portal: http://$($localIP):5173" -ForegroundColor Yellow
Write-Host ""
Write-Host "Admin Credentials: username 'admin', password 'admin123'" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
