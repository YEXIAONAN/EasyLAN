@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows.ps1" %*
set "localchat_exit=%ERRORLEVEL%"
if not "%localchat_exit%"=="0" pause
exit /b %localchat_exit%
