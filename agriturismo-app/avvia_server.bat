@echo off
title Server Comande Agriturismo
cd /d "%~dp0"
echo Avvio server sulla porta 4000...
echo Tieni questa finestra aperta per tutto il servizio.
echo.
node server.js
pause
