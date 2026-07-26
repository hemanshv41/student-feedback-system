Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting EduFeedback AI System Servers    " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start the FastAPI Python Backend
Write-Host "[1/2] Launching FastAPI Backend on http://localhost:8000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --reload --port 8000"

# 2. Start the Vite React Frontend
Write-Host "[2/2] Launching React Dev Server on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "---------------------------------------------" -ForegroundColor Cyan
Write-Host "FastAPI Swagger Docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "Student Feedback Portal & Dashboard: http://localhost:5173" -ForegroundColor Yellow
Write-Host "Admin Credentials: username 'admin', password 'admin123'" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Cyan
