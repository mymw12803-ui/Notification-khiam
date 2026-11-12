@echo off
chcp 65001 >nul
title منظومة الإشعارات - الخادم
cd /d "%~dp0server"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js غير مثبت على هذا الجهاز.
  echo  حمّله من https://nodejs.org ثم شغّل هذا الملف مرة أخرى.
  echo.
  pause
  exit /b
)
if not exist node_modules (
  echo  جاري تثبيت المكتبات لأول مرة...
  call npm install --no-audit --no-fund
)
node server.js
pause
