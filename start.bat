@echo off
echo ===================================================
echo 🚀 Starting Traffic Analytics Platform Control Panel
echo ===================================================
echo.

:: Start Flask Backend
echo [1/2] Launching Flask Backend (Conda: FYPAI)...
start powershell -NoExit -Command "cd backend; & 'D:\miniforge\shell\condabin\conda-hook.ps1'; conda activate FYPAI; python app.py"

:: Start Next.js Frontend
echo [2/2] Launching Next.js Frontend...
start powershell -NoExit -Command "cd frontend; npm run dev"

echo.
echo ✅ Both backend and frontend have been launched in separate terminal windows!
echo.
pause
