@echo off
setlocal

cd /d "%~dp0"

set "SERVER_PORT=7001"
if exist ".env" (
  for /f "usebackq tokens=1,* delims==" %%A in (`findstr /b /c:"SERVER_PORT=" ".env"`) do (
    set "SERVER_PORT=%%B"
  )
)

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

set "SERVER_PORT_IN_USE="
for /f %%I in ('powershell -NoProfile -Command "if ((Get-NetTCPConnection -LocalPort %SERVER_PORT% -State Listen -ErrorAction SilentlyContinue)) { 'true' } else { 'false' }"') do set "SERVER_PORT_IN_USE=%%I"

if /I "%SERVER_PORT_IN_USE%"=="true" (
  echo [AAF] Backend port %SERVER_PORT% already in use. Skip starting server terminal.
) else (
  start "AAF Server" cmd /k "npm run dev -w server"
)

start "AAF Client" cmd /k "npm run dev -w client"

timeout /t 3 >nul
start "" "http://localhost:5174"

echo [AAF] Done. Two terminals started and browser opened at http://localhost:5174
echo [AAF] Close this window if no longer needed.
