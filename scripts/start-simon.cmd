@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-simon.ps1" %*
exit /b %ERRORLEVEL%
