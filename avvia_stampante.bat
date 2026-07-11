@echo off
title AGENTE STAMPANTE (AUTO-RESTART)
:loop
echo [%time%] Avvio del Print Agent... >> C:\risto\log_stampante.txt

:: Entra nella sottocartella specifica del print agent
cd /d C:\risto\asporto-app\print-agent
node index.js

echo [%time%] ATTENZIONE: Arrestato! Riavvio in corso... >> C:\risto\log_stampante.txt
echo Il processo e crashato! Riavvio automatico tra 3 secondi...
timeout /t 3
goto loop