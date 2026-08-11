@echo off
echo === [%time%] Ricevuto push da Git: Aggiorno e ricompilo === >> C:\risto\log_git.txt

:: 1. Tiriamo giu le novita per TUTTO il progetto (cartella principale)
cd /d C:\risto
git pull >> C:\risto\log_git.txt 2>&1
if not %errorlevel%==0 (
    echo === [%time%] ERRORE: git pull fallito, aggiornamento interrotto === >> C:\risto\log_git.txt
    exit /b 1
)

:: 2. Aggiorniamo e compiliamo il frontend
cd /d C:\risto\asporto-app
for /f "delims=" %%H in ('git -C C:\risto rev-parse HEAD') do set AP_HEAD=%%H
for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set AP_TS=%%T
echo commit=%AP_HEAD%> public\version.txt
echo builtAt=%AP_TS%>> public\version.txt
call npm install >> C:\risto\log_git.txt 2>&1
if not %errorlevel%==0 (
    echo === [%time%] ERRORE: npm install fallito, build saltata, sito NON aggiornato === >> C:\risto\log_git.txt
    exit /b 1
)
call npm run build >> C:\risto\log_git.txt 2>&1
if not %errorlevel%==0 (
    echo === [%time%] ERRORE: npm run build fallito, sito NON aggiornato ^(resta la build precedente^) === >> C:\risto\log_git.txt
    exit /b 1
)

:: 3. Ricarichiamo Nginx dalla sua nuova casa per applicare le modifiche
cd /d C:\risto\nginx
nginx.exe -s reload >> C:\risto\log_git.txt 2>&1

echo === [%time%] Compilazione e riavvio completati con successo === >> C:\risto\log_git.txt
