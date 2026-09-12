@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ============================================
::   Korean Brands Xiaohongshu AI Filter Demo
:: ============================================
echo.

cd /d "%~dp0"

:: 1. Check DeepSeek API Key
if "%DEEPSEEK_API_KEY%"=="" (
    echo [WARN] DEEPSEEK_API_KEY not detected, will use fallback
    echo        Set: set DEEPSEEK_API_KEY=sk-...
    echo.
) else (
    echo [OK] DEEPSEEK_API_KEY detected
    echo.
)

:: 2. Skip scoring engine (run manually: python -m app.main)
echo [INFO] Skipping scoring engine (run manually: python -m app.main)
echo.

:: 3. Kill existing processes on port 5000
echo [INFO] Killing existing processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000 ^| findstr LISTENING') do (
    echo [INFO] Killing PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)
wmic process where "name='uvicorn.exe'" call terminate >nul 2>&1
taskkill /IM "uvicorn.exe" /F >nul 2>&1
echo [OK] Done stopping existing processes
echo.

:: Wait for ports to be released
timeout /t 2 /nobreak >nul

:: 4. Start Web service
echo [INFO] Starting FastAPI Web service...
echo [INFO] Main page: http://127.0.0.1:5000
echo [INFO] API docs: http://127.0.0.1:5000/docs
echo [INFO] Press Ctrl+C to stop
echo.

:: 5. Auto open browser
timeout /t 2 /nobreak >nul
start http://127.0.0.1:5000

:: 6. Start uvicorn
uvicorn app.web:app --reload --port 5000

pause
