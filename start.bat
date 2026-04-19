@echo off
setlocal EnableExtensions

cd /d "%~dp0"

set "SERVER_PORT=7001"
set "CLIENT_PORT=5174"
set "POWERSHELL_BIN="

echo [AAF] Checking runtime environment...

call :ensure_node
if errorlevel 1 (
  echo [AAF] Failed to prepare Node.js environment.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [AAF] npm is not available in PATH.
  echo [AAF] Reinstall Node.js and ensure npm is included.
  pause
  exit /b 1
)

call :ensure_powershell
if errorlevel 1 (
  echo [AAF] Failed to prepare PowerShell environment.
  pause
  exit /b 1
)

if not exist ".env" (
  if exist ".env.example" (
    echo [AAF] .env not found. Creating from .env.example...
    copy /Y ".env.example" ".env" >nul
  ) else (
    echo [AAF] .env and .env.example are both missing. Please create .env manually.
    pause
    exit /b 1
  )
)

for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"SERVER_PORT=" ".env"') do set "SERVER_PORT=%%B"
for /f "tokens=1,* delims==" %%A in ('findstr /b /c:"CLIENT_PORT=" ".env"') do set "CLIENT_PORT=%%B"

if not exist "data\sqlite" (
  echo [AAF] Creating data\sqlite directory...
  mkdir "data\sqlite"
)

echo [AAF] Validating npm workspace dependencies...
call npm ls --depth=0 >nul 2>nul
if errorlevel 1 (
  echo [AAF] Missing or broken dependencies detected. Running npm install...
  call npm install
  if errorlevel 1 (
    echo [AAF] npm install failed. Please check network and npm registry settings.
    pause
    exit /b 1
  )
) else (
  echo [AAF] Dependencies look good.
)

echo [AAF] Preparing Prisma client and database migrations...
call npm run db:generate
if errorlevel 1 (
  echo [AAF] Prisma client generation failed.
  pause
  exit /b 1
)

call npm run prisma:deploy -w server
if errorlevel 1 (
  echo [AAF] Prisma migration deploy failed.
  pause
  exit /b 1
)

set "SERVER_PORT_IN_USE="
for /f %%I in ('"%POWERSHELL_BIN%" -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %SERVER_PORT% -State Listen -ErrorAction SilentlyContinue) { 'true' } else { 'false' }"') do set "SERVER_PORT_IN_USE=%%I"

set "CLIENT_PORT_IN_USE="
for /f %%I in ('"%POWERSHELL_BIN%" -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %CLIENT_PORT% -State Listen -ErrorAction SilentlyContinue) { 'true' } else { 'false' }"') do set "CLIENT_PORT_IN_USE=%%I"

if /I "%SERVER_PORT_IN_USE%"=="true" (
  echo [AAF] Backend port %SERVER_PORT% is already in use. Skip starting backend.
) else (
  start "AAF Server" cmd /k "npm run dev -w server"
)

if /I "%CLIENT_PORT_IN_USE%"=="true" (
  echo [AAF] Frontend port %CLIENT_PORT% is already in use. Skip starting frontend.
) else (
  start "AAF Client" cmd /k "npm run dev -w client"
)

timeout /t 3 >nul
start "" "http://localhost:%CLIENT_PORT%"

echo [AAF] Environment checks passed. Services are launching.
echo [AAF] Browser opened at http://localhost:%CLIENT_PORT%
echo [AAF] This script is complete.
exit /b 0

:ensure_node
where node >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Node.js detected.
  exit /b 0
)

echo [AAF] Node.js not found. Trying automatic installation...
call :install_node

where node >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Node.js installation completed.
  exit /b 0
)

if exist "C:\Program Files\nodejs\node.exe" (
  set "PATH=C:\Program Files\nodejs;%PATH%"
)

where node >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Node.js installed and added to current PATH.
  exit /b 0
)

echo [AAF] Node.js is still unavailable after installation attempts.
echo [AAF] Please install Node.js LTS manually from https://nodejs.org/
exit /b 1

:install_node
where winget >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Installing Node.js LTS via winget...
  call winget install --id OpenJS.NodeJS.LTS --exact --accept-source-agreements --accept-package-agreements --silent
  if not errorlevel 1 exit /b 0
)

where choco >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Installing Node.js LTS via choco...
  call choco install nodejs-lts -y
  if not errorlevel 1 exit /b 0
)

exit /b 1

:ensure_powershell
where powershell >nul 2>nul
if not errorlevel 1 (
  set "POWERSHELL_BIN=powershell"
  echo [AAF] Windows PowerShell detected.
  exit /b 0
)

where pwsh >nul 2>nul
if not errorlevel 1 (
  set "POWERSHELL_BIN=pwsh"
  echo [AAF] PowerShell detected.
  exit /b 0
)

echo [AAF] PowerShell not found. Trying automatic installation...
call :install_powershell

where pwsh >nul 2>nul
if not errorlevel 1 (
  set "POWERSHELL_BIN=pwsh"
  echo [AAF] PowerShell installation completed.
  exit /b 0
)

if exist "C:\Program Files\PowerShell\7\pwsh.exe" (
  set "POWERSHELL_BIN=C:\Program Files\PowerShell\7\pwsh.exe"
  echo [AAF] PowerShell installed and ready.
  exit /b 0
)

where powershell >nul 2>nul
if not errorlevel 1 (
  set "POWERSHELL_BIN=powershell"
  echo [AAF] Windows PowerShell detected after retry.
  exit /b 0
)

echo [AAF] PowerShell is still unavailable after installation attempts.
echo [AAF] Please install PowerShell manually from https://aka.ms/powershell
exit /b 1

:install_powershell
where winget >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Installing PowerShell via winget...
  call winget install --id Microsoft.PowerShell --exact --accept-source-agreements --accept-package-agreements --silent
  if not errorlevel 1 exit /b 0
)

where choco >nul 2>nul
if not errorlevel 1 (
  echo [AAF] Installing PowerShell via choco...
  call choco install powershell-core -y
  if not errorlevel 1 exit /b 0
)

exit /b 1
