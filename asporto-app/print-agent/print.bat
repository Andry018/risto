@echo off
title Stampa Prezzi Rapida
color 0B

cd /d C:\risto\asporto-app\print-agent

:INIZIO
cls
echo =========================================================
echo   STAMPA PREZZI AL VOLO (Piu prezzi? Separali con spazio)
echo =========================================================
echo.
set /p PREZZI="Scrivi i prezzi (es. 4 10 15) e premi INVIO: "

node stampa_prezzo.js %PREZZI%

echo.
echo =========================================================
pause
goto INIZIO