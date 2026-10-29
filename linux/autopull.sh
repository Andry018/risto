#!/bin/bash
# Aggiorna il gestionale dal repo GitHub: pull, build, migrazioni DB, config nginx/systemd, riavvio agenti.
# Lanciato da risto-autopull.timer (via autopull-check.sh, solo se ci sono commit nuovi),
# dal Pannello Sistema (/admin/api/autopull) o a mano: bash /opt/risto/linux/autopull.sh
set -euo pipefail

# systemd / pct exec partono con un PATH minimo: la CLI supabase sta in /usr/local/bin
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

RISTO_BASE="${RISTO_BASE:-/opt/risto}"
LOG="$RISTO_BASE/logs/autopull.log"
mkdir -p "$RISTO_BASE/logs"

# Un solo aggiornamento alla volta (timer + pulsante del pannello)
exec 9>/run/risto-autopull.lock
if ! flock -n 9; then
  echo "[$(date -Iseconds)] Autopull già in corso, salto" >> "$LOG"
  exit 0
fi

echo "[$(date -Iseconds)] Autopull avviato" >> "$LOG"

cd "$RISTO_BASE"
# Le versioni precedenti di questo script cancellavano il lockfile: ripristinalo,
# altrimenti git pull si blocca quando il lockfile cambia su GitHub
git checkout -- asporto-app/package-lock.json >> "$LOG" 2>&1 || true
git pull --ff-only >> "$LOG" 2>&1

cd asporto-app
# npm ci = esattamente le versioni del lockfile (quelle testate). Il lockfile non contiene
# più pacchetti solo-Windows obbligatori: le varianti linux sono incluse come opzionali.
npm ci >> "$LOG" 2>&1

# Scrivi version.txt prima della build (come in start.bat / autopull.bat)
git -C "$RISTO_BASE" rev-parse HEAD > public/version.txt
echo "builtAt=$(date -Iseconds)" >> public/version.txt

npm run build >> "$LOG" 2>&1

# Migrazioni DB (best-effort: un errore non blocca l'aggiornamento, ma resta nel log)
cd "$RISTO_BASE"
supabase migration up --local --workdir "$RISTO_BASE" >> "$LOG" 2>&1 || echo "[$(date -Iseconds)] WARN: migration up fallita (vedi sopra)" >> "$LOG"

# Config nginx: si aggiorna col repo, ma solo se passa `nginx -t` (altrimenti torna la precedente)
nginx_changed=0
for f in nginx.conf proxy_supabase.conf; do
  if [ -f "linux/$f" ] && ! cmp -s "linux/$f" "/etc/nginx/$f"; then
    [ -f "/etc/nginx/$f" ] && cp "/etc/nginx/$f" "/etc/nginx/$f.prev"
    cp "linux/$f" "/etc/nginx/$f"
    nginx_changed=1
  fi
done
if [ "$nginx_changed" = 1 ]; then
  if nginx -t >> "$LOG" 2>&1; then
    systemctl reload nginx >> "$LOG" 2>&1 && echo "[$(date -Iseconds)] nginx aggiornato" >> "$LOG"
  else
    for f in nginx.conf proxy_supabase.conf; do
      [ -f "/etc/nginx/$f.prev" ] && cp "/etc/nginx/$f.prev" "/etc/nginx/$f"
    done
    echo "[$(date -Iseconds)] ERRORE: nuova config nginx non valida, ripristinata la precedente" >> "$LOG"
  fi
fi

# Unità systemd già installate: aggiornale se cambiate nel repo (le nuove vanno abilitate a mano, vedi setup.sh)
units_changed=0
for unit in linux/services/*.service linux/services/*.timer; do
  [ -f "$unit" ] || continue
  target="/etc/systemd/system/$(basename "$unit")"
  if [ -f "$target" ] && ! cmp -s "$unit" "$target"; then
    cp "$unit" "$target"
    units_changed=1
  fi
done
[ "$units_changed" = 1 ] && systemctl daemon-reload

# Riavvia servizi aggiornati (risto-admin no: può essere lui ad aver lanciato questo script)
systemctl restart risto-print >> "$LOG" 2>&1 || true
systemctl restart risto-ecr >> "$LOG" 2>&1 || true
systemctl restart risto-wa >> "$LOG" 2>&1 || true

echo "[$(date -Iseconds)] Autopull completato ($(git rev-parse --short HEAD))" >> "$LOG"
