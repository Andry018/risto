@echo off
title AGENTE ECR - PAX A35 (AUTO-RESTART)
:loop
echo [%time%] Avvio ECR Agent... >> C:\risto\log_ecr.txt

:: Copia .env se non esiste ancora
if not exist "C:\risto\asporto-app\ecr-agent\.env" (
    if exist "C:\risto\asporto-app\ecr-agent\.env.example" (
        copy "C:\risto\asporto-app\ecr-agent\.env.example" "C:\risto\asporto-app\ecr-agent\.env"
        echo [%time%] .env creato da .env.example — configurare PAX_HOST! >> C:\risto\log_ecr.txt
    )
)

cd /d C:\risto\asporto-app\ecr-agent
node index.js

echo [%time%] ATTENZIONE: ECR Agent arrestato! Riavvio in corso... >> C:\risto\log_ecr.txt
echo Il processo e crashato! Riavvio automatico tra 3 secondi...
timeout /t 3
goto loop
