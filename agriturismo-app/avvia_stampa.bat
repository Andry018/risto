@echo off
title Stazione di Stampa Agriturismo
echo Apro la stazione di stampa in Chrome (stampa automatica, senza finestre di conferma)...

set CHROME=
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe
if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe

if "%CHROME%"=="" (
  echo Chrome non trovato nei percorsi standard.
  echo Apri manualmente Chrome con il flag --kiosk-printing su http://localhost:4000/stampa.html
  pause
  exit /b 1
)

"%CHROME%" --kiosk-printing --new-window "http://localhost:4000/stampa.html"
