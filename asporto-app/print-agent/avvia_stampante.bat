@echo off
title AGENTE STAMPANTE (AUTO-RESTART)
:loop
echo [%time%] Avvio del Print Agent... >> C:\risto\log_stampante.txt
cd /d C:\risto\asporto-app\print-agent

:: >>> MODIFICA QUESTA RIGA CON IL COMANDO REALE DEL TUO PRINT AGENT <<<
:: Esempio se è un file node: node index.js
:: Esempio se è un eseguibile: print_agent.exe
node index.js

echo [%time%] ATTENZIONE: Il Print Agent si e arrestato! Riavvio in corso... >> C:\risto\log_stampante.txt
echo Il Print Agent e crashato! Riavvio automatico tra 3 secondi...
timeout /t 3
goto loop