@echo off
title BACKUP DATABASE RISTORANTE
cd /d C:\risto

for /f "delims=" %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmmss"') do set BK_TS=%%T
set BK_DIR=C:\risto\backups\db\%BK_TS%
if not exist "C:\risto\backups\db" mkdir "C:\risto\backups\db"
mkdir "%BK_DIR%"

echo [%date% %time%] Backup avviato in %BK_DIR% >> C:\risto\backups\backup_log.txt

call supabase db dump --local -f "%BK_DIR%\schema.sql" >> C:\risto\backups\backup_log.txt 2>&1
if not %errorlevel%==0 (
    echo [%date% %time%] ERRORE: dump schema fallito, backup incompleto >> C:\risto\backups\backup_log.txt
    exit /b 1
)

call supabase db dump --local --data-only -f "%BK_DIR%\data.sql" >> C:\risto\backups\backup_log.txt 2>&1
if not %errorlevel%==0 (
    echo [%date% %time%] ERRORE: dump dati fallito, backup incompleto >> C:\risto\backups\backup_log.txt
    exit /b 1
)

echo [%date% %time%] Backup completato con successo ^(%BK_DIR%^) >> C:\risto\backups\backup_log.txt

:: Rotazione: elimina backup piu' vecchi di 14 giorni
powershell -NoProfile -Command "Get-ChildItem 'C:\risto\backups\db' -Directory -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"

:: Copia opzionale su una seconda posizione (consigliato: unita' esterna o cartella sincronizzata cloud).
:: Un backup che vive solo su C:\risto non protegge da guasto/furto/incendio del PC.
:: Scommenta e adatta il percorso quando ne configuri una:
:: robocopy "%BK_DIR%" "D:\BackupRisto\%BK_TS%" /E >> C:\risto\backups\backup_log.txt 2>&1

echo [%date% %time%] Rotazione completata >> C:\risto\backups\backup_log.txt
