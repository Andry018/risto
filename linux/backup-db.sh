#!/bin/bash
# Backup notturno del CT (lanciato da risto-backup.timer alle 04:00, o a mano).
#
#   /opt/risto/backups/db/<data>/
#     supabase.sql.gz   database del gestionale completo (pg_dumpall: dati, ruoli, impostazioni)
#     whatsapp.sql.gz   database di Evolution API (chat WhatsApp), se il container è attivo
#     config.tar.gz     i .env (chiavi, secret): servono per ripristinare il server da zero
#
# Tiene gli ultimi 14 giorni. File leggibili solo da root (contengono segreti e dati clienti).
# Copia esterna opzionale: BACKUP_EXTRA_DIR=/mnt/usb/risto (disco USB, NAS montato, ...)
# Ripristino del database: zcat supabase.sql.gz | docker exec -i supabase_db_asporto-app psql -U supabase_admin -d postgres
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

BASE="${RISTO_BASE:-/opt/risto}"
ROOT="$BASE/backups/db"
LOG="$BASE/logs/backup.log"
KEEP_DAYS=14
DEST="$ROOT/$(date +%F_%H%M)"

mkdir -p "$DEST" "$BASE/logs"
chmod 700 "$BASE/backups" "$ROOT"
log() { echo "[$(date -Iseconds)] $*" >> "$LOG"; }
fail() { log "ERRORE: $*"; echo "ERRORE: $*" >&2; exit 1; }

log "Backup avviato in $DEST"

docker exec supabase_db_asporto-app pg_dumpall -U supabase_admin | gzip > "$DEST/supabase.sql.gz" \
  || fail "dump database gestionale fallito"
gzip -t "$DEST/supabase.sql.gz" || fail "archivio database corrotto"
[ "$(stat -c %s "$DEST/supabase.sql.gz")" -gt 1000000 ] || fail "dump database sospetto (meno di 1 MB)"

if docker ps --format '{{.Names}}' | grep -qx risto-evolution-db; then
  docker exec risto-evolution-db pg_dump -U evolution evolution | gzip > "$DEST/whatsapp.sql.gz" \
    || log "ATTENZIONE: dump WhatsApp fallito (il backup del gestionale è comunque valido)"
fi

tar -czf "$DEST/config.tar.gz" -C "$BASE" --ignore-failed-read \
  supabase/.env asporto-app/.env asporto-app/ecr-agent/.env asporto-app/print-agent/.env \
  asporto-app/wa-agent/.env admin-server/secrets.env telegram-bot/.env 2>/dev/null || true

chmod -R go-rwx "$DEST"
log "Backup completato: $(du -sh "$DEST" | cut -f1)"

# Rotazione
find "$ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true

# Copia esterna (se configurata e montata)
if [ -n "${BACKUP_EXTRA_DIR:-}" ]; then
  if [ -d "$BACKUP_EXTRA_DIR" ]; then
    mkdir -p "$BACKUP_EXTRA_DIR/db"
    cp -r "$DEST" "$BACKUP_EXTRA_DIR/db/" && log "Copia esterna in $BACKUP_EXTRA_DIR"
    find "$BACKUP_EXTRA_DIR/db" -mindepth 1 -maxdepth 1 -type d -mtime +"$KEEP_DAYS" -exec rm -rf {} + 2>/dev/null || true
  else
    log "ATTENZIONE: BACKUP_EXTRA_DIR=$BACKUP_EXTRA_DIR non disponibile, copia esterna saltata"
  fi
fi
