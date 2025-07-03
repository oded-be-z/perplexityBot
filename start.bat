@echo off
cls
echo.
echo ╔════════════════════════════════════════════════════════════╗
echo ║                  🚀 FinanceBot Pro v4.0                    ║
echo ║                   Docker Launch Script                     ║
echo ╚════════════════════════════════════════════════════════════╝
echo.
echo 📋 Starting FinanceBot Pro with Docker...
echo.
echo ⏳ Building and starting containers (this may take a few minutes)...
echo.

docker-compose up --build

echo.
echo 🔴 FinanceBot has stopped running.
echo.
echo 💡 To restart, just double-click this file again!
echo.
pause 