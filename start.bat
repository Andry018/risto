@echo off
title SERVER RISTORANTE - PRODUZIONE (NGINX)
mode con: cols=85 lines=35
color 0A

echo ===================================================
echo   [1/7] AGGIORNAMENTO CODICE DA GIT
echo ===================================================
cd /d C:\risto
git pull
if not %errorlevel%==0 (
    echo.
    echo [ATTENZIONE] git pull ha restituito un errore ^(modifiche locali in conflitto?^).
    echo Procedo comunque con la build, ma il codice potrebbe non essere aggiornato.
    pause
)
for /f "delims=" %%H in ('git rev-parse HEAD') do set NEW_HEAD=%%H
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

if not exist "C:\risto\logs" mkdir "C:\risto\logs"
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set BUILD_TS=%%T
set BUILD_LOG=C:\risto\logs\build_%BUILD_TS%.log
echo Log salvato in: %BUILD_LOG%
set ERR_TMP=%BUILD_LOG%.stderr.tmp

echo commit=%NEW_HEAD%> public\version.txt
echo builtAt=%BUILD_TS%>> public\version.txt

echo Installazione/aggiornamento dipendenze npm...
powershell -NoProfile -Command "npm install 2> '%ERR_TMP%' | Tee-Object -FilePath '%BUILD_LOG%'; exit $LASTEXITCODE"
set INSTALL_RC=%errorlevel%
if exist "%ERR_TMP%" (
    type "%ERR_TMP%" >> "%BUILD_LOG%"
    del "%ERR_TMP%"
)
if not %INSTALL_RC%==0 (
    echo.
    echo [ERRORE] npm install fallito! Controlla il log: %BUILD_LOG%
    echo.
    pause
)
echo Generazione dei file statici ottimizzati in corso...
powershell -NoProfile -Command "npm run build 2> '%ERR_TMP%' | Tee-Object -FilePath '%BUILD_LOG%' -Append; exit $LASTEXITCODE"
set BUILD_RC=%errorlevel%
if exist "%ERR_TMP%" (
    type "%ERR_TMP%" >> "%BUILD_LOG%"
    del "%ERR_TMP%"
)
if not %BUILD_RC%==0 (
    echo.
    echo [ERRORE] Build fallita! Controlla il log: %BUILD_LOG%
    echo.
    pause
)
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
    powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'C:\risto\webhook.exe' -ArgumentList '-hooks C:\risto\hooks.json -verbose -port 9000'"
    echo Webhook attivo su porta 9000 (nascosto).
) else (
    echo [ATTENZIONE] webhook.exe non trovato in C:\risto. Salto questo step.
)
echo.

echo ===================================================
echo   [6/7] AVVIO PANNELLO AMMINISTRAZIONE (PORTA 4000)
echo ===================================================
:: Chiude un eventuale processo rimasto appeso sulla porta 4000, altrimenti
:: il nuovo pannello si sposta su 4001+ e nginx (fissa su 4000) da' sempre 502.
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
if exist "C:\risto\avvia_pannello.bat" (
    powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c C:\risto\avvia_pannello.bat'"
    echo Dashboard di amministrazione attiva (nascosta).
) else (
    echo [ATTENZIONE] avvia_pannello.bat non trovato. Salto questo step.
)
echo.

echo ===================================================
echo   [7/8] AVVIO PRINT AGENT (STAMPANTE)
echo ===================================================
if exist "C:\risto\avvia_stampante.bat" (
    powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c C:\risto\avvia_stampante.bat'"
    echo Print agent attivo su porta 8787 (nascosto).
) else (
    echo [ERRORE] avvia_stampante.bat non trovato!
)
echo.

echo ===================================================
echo   [8/8] AVVIO ECR AGENT (PAX A35 - NEXI)
echo ===================================================
if exist "C:\risto\avvia_ecr.bat" (
    powershell -Command "Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c C:\risto\avvia_ecr.bat'"
    echo ECR agent attivo su porta 8788 (nascosto).
) else (
    echo [ATTENZIONE] avvia_ecr.bat non trovato. Pagamento carta non disponibile.
)
echo.

echo ===================================================
echo   SISTEMA DI PRODUZIONE AVVIATO CON SUCCESSO! [8 servizi]
echo   Il gestionale e' raggiungibile su: https://gestionale.90-minuti.it
echo   Pannello admin: https://gestionale.90-minuti.it/admin
echo   ATTENZIONE: Non usare l'indirizzo IP. Usa solo il dominio ufficiale!
echo   La rete Wi-Fi interna (AdGuard) gestira' il traffico in automatico.
echo ===================================================
pause