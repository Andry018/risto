@echo off
title PANNELLO AMMINISTRAZIONE (AUTO-RESTART)
:loop
cd /d C:\risto\admin-server
echo [%time%] Avvio Pannello Amministrazione su porta 4000...
node server.js
echo [%time%] Arrestato! Riavvio in corso... >> C:\risto\log_admin.txt
timeout /t 3
goto loop
