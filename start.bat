@echo off
setlocal

cd /d "%~dp0"

echo [AAF] Starting backend and frontend...

if not exist "node_modules" (
  echo [AAF] node_modules not found. Running npm install first...
  call npm install
  if errorlevel 1 (
    echo [AAF] npm install failed. Press any key to exit.
    pause >nul
    exit /b 1
  )
)

start "AAF Server" cmd /k "npm run dev -w server"
start "AAF Client" cmd /k "npm run dev -w client"

timeout /t 3 >nul
start "" "http://localhost:5174"

echo [AAF] Done. Two terminals started and browser opened at http://localhost:5174
echo [AAF] Close this window if no longer needed.
