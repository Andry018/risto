@echo off
title PANNELLO AMMINISTRAZIONE
cd /d C:\risto\admin-server
echo [%time%] Avvio Pannello Amministrazione su porta 4000...
node server.js
pause
