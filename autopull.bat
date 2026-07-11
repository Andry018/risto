@echo off
echo === [%time%] Ricevuto push da Git: Aggiorno e ricompilo === >> C:\risto\log_git.txt

:: 1. Tiriamo giu le novita per TUTTO il progetto (cartella principale)
cd /d C:\risto
git pull >> C:\risto\log_git.txt 2>&1

:: 2. Aggiorniamo e compiliamo il frontend
cd /d C:\risto\asporto-app
call npm install >> C:\risto\log_git.txt 2>&1
call npm run build >> C:\risto\log_git.txt 2>&1

:: 3. Ricarichiamo Nginx dalla sua nuova casa per applicare le modifiche
cd /d C:\risto\nginx
nginx.exe -s reload >> C:\risto\log_git.txt 2>&1

echo === [%time%] Compilazione e riavvio completati con successo === >> C:\risto\log_git.txt