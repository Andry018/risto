#!/bin/bash
# Eseguito dal webhook GitHub — stesso ruolo di autopull.bat su Windows
set -euo pipefail

RISTO_BASE="${RISTO_BASE:-/opt/risto}"
LOG="$RISTO_BASE/logs/autopull.log"

mkdir -p "$RISTO_BASE/logs"
echo "[$(date -Iseconds)] Autopull avviato" >> "$LOG"

cd "$RISTO_BASE"
git pull >> "$LOG" 2>&1

cd asporto-app
# Rimuovi lockfile generato su Windows (contiene binari win32 incompatibili)
rm -f package-lock.json
npm install >> "$LOG" 2>&1

# Scrivi version.txt prima della build (come in start.bat / autopull.bat)
git -C "$RISTO_BASE" rev-parse HEAD > public/version.txt
echo "builtAt=$(date -Iseconds)" >> public/version.txt

npm run build >> "$LOG" 2>&1

echo "[$(date -Iseconds)] Autopull completato" >> "$LOG"
