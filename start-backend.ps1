# ─── Start All Backend Services ─────────────────────────────────────────────
# Run this script from the root automated-interview directory
# Usage: .\start-backend.ps1

Write-Host "🚀 Starting AI Interview Backend Services..." -ForegroundColor Cyan

# ─── Python AI Service (port 8000) ──────────────────────────────────────────
Write-Host "`n[1/2] Starting Python AI Service on port 8000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot\python-ai-service'; .\venv\Scripts\uvicorn.exe app.main:app --host 0.0.0.0 --port 8000 --reload"
) -WindowStyle Normal

Start-Sleep -Seconds 3

# ─── Spring Boot Backend (port 8081) ────────────────────────────────────────
Write-Host "[2/2] Starting Spring Boot Backend on port 8081..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$PSScriptRoot\spring-boot-backend'; `$env:PYTHON_AI_URL='http://localhost:8000'; `$env:UPLOAD_DIR='../uploads'; `$env:SQLITE_DB_PATH='../data/interview.db'; mvn spring-boot:run"
) -WindowStyle Normal

Write-Host "`n✅ Both backend services launching in separate windows." -ForegroundColor Green
Write-Host "   Python AI  → http://localhost:8000/health" -ForegroundColor Gray
Write-Host "   Spring Boot → http://localhost:8081/api/auth/login" -ForegroundColor Gray
Write-Host "`n🌐 Frontend is at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "`nTo start the frontend separately:" -ForegroundColor Gray
Write-Host "   cd frontend && npm start" -ForegroundColor Gray
