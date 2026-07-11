@echo off
title SERVER RISTORANTE - PRODUZIONE (NGINX)
mode con: cols=85 lines=35
color 0A

echo ===================================================
echo   [1/7] AGGIORNAMENTO CODICE DA GIT
echo ===================================================
cd /d C:\risto
git pull
echo.

echo ===================================================
echo   [2/7] CONTROLLO DOCKER E AVVIO SUPABASE
echo ===================================================
:: Controlla se Docker è attivo. Se lo trova, salta direttamente all'avvio di Supabase
tasklist | findstr /i "Docker" >nul && goto :start_supabase

echo Docker e chiuso. Avvio in corso...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
echo In attesa che Docker si svegli (45 secondi)...
timeout /t 45

:start_supabase
cd /d C:\risto
call supabase start
echo.

echo ===================================================
echo   [3/7] COMPILAZIONE FRONTEND (BUILD VITE)
echo ===================================================
cd /d C:\risto\asporto-app
echo Generazione dei file statici ottimizzati in corso...
call npm run build
echo.

echo ===================================================
echo   [4/7] AVVIO WEB SERVER NGINX (C:\risto\nginx)
echo ===================================================
cd /d C:\risto\nginx
:: Chiude eventuali istanze di nginx rimaste appese e lo riavvia
taskkill /f /im nginx.exe >nul 2>&1
start nginx.exe
echo Nginx avviato sulla porta 80!
echo.

echo ===================================================
echo   [5/7] AVVIO WEBHOOK (AGGIORNAMENTI BACKGROUND)
echo ===================================================
cd /d C:\risto
if exist "C:\risto\webhook.exe" (
    start /min "" "C:\risto\webhook.exe" -hooks C:\risto\hooks.json -verbose -port 9000
    REM Questo e' un test per il deploy automatico!
    
) else (
    echo [ATTENZIONE] webhook.exe non trovato in C:\risto. Salto questo step.
)
echo.

echo ===================================================
echo   [6/7] AVVIO PANNELLO AMMINISTRAZIONE (PORTA 4000)
echo ===================================================
if exist "C:\risto\avvia_pannello.bat" (
    start /min "" cmd /c "C:\risto\avvia_pannello.bat"
    echo Dashboard di amministrazione attiva in background...
) else (
    echo [ATTENZIONE] avvia_pannello.bat non trovato. Salto questo step.
)
echo.

echo ===================================================
echo   [7/7] AVVIO PRINT AGENT (STAMPANTE)
echo ===================================================
if exist "C:\risto\avvia_stampante.bat" (
    start "" cmd /c "C:\risto\avvia_stampante.bat"
    echo Monitoraggio stampante attivo...
) else (
    echo [ERRORE] avvia_stampante.bat non trovato!
)
echo.

echo ===================================================
echo   SISTEMA DI PRODUZIONE AVVIATO CON SUCCESSO!
echo   Il sito e raggiungibile su: http://192.168.1.250
echo   Pannello admin: http://192.168.1.250/admin
echo ===================================================
pause