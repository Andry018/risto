@echo off
title PANNELLO AMMINISTRAZIONE
cd /d C:\risto\admin-server
if not exist "secrets.bat" (
    echo [ERRORE] secrets.bat non trovato in questa cartella.
    echo Copia secrets.bat.example in secrets.bat e imposta ADMIN_SECRET.
    pause
    exit /b 1
)
call secrets.bat
echo [%time%] Avvio Pannello Amministrazione su porta 4000...
node server.js
pause
