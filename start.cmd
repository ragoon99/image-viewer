@echo off
rem Windows launcher for the image viewer (macOS/Linux: ./start.sh)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
exit /b %ERRORLEVEL%
