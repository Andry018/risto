@echo off
title PANNELLO AMMINISTRAZIONE (AUTO-RESTART)
cd /d C:\risto\admin-server
if not exist "secrets.bat" (
    echo [ERRORE] admin-server\secrets.bat non trovato.
    echo Copia secrets.bat.example in secrets.bat e imposta ADMIN_SECRET.
    pause
    exit /b 1
)
call secrets.bat
:loop
cd /d C:\risto\admin-server
echo [%time%] Avvio Pannello Amministrazione su porta 4000...
node server.js
echo [%time%] Arrestato! Riavvio in corso... >> C:\risto\log_admin.txt
timeout /t 3
goto loop
