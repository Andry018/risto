#!/bin/bash
# Cambia il JWT secret del Supabase locale.
#
# Perché: la CLI usa di default un secret PUBBLICO (uguale per tutti, è nella documentazione).
# Con quello chiunque può firmarsi un token service_role e scavalcare tutte le regole del database.
#
# Cosa fa (sul CT, come root):
#   1. backup completo del database in /opt/risto/backups
#   2. nuovo secret in supabase/.env (letto dalla CLI) e riavvio di Supabase
#   3. app.settings.jwt_secret (lo usa staff_login per firmare i token dello staff)
#   4. nuove chiavi anon/service nei .env (app, print-agent, telegram-bot) e rebuild del frontend
#   5. verifica: vecchia chiave rifiutata, nuova accettata, token staff accettato
#
# Uso:  bash /opt/risto/linux/rotate-jwt-secret.sh
# Rilanciabile: se supabase/.env ha già un secret, riusa quello (es. dopo un errore a metà).
# Dopo: i tablet devono aggiornare l'app (banner) e rifare il PIN una volta.
set -euo pipefail
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

BASE="${RISTO_BASE:-/opt/risto}"
ENV_FILE="$BASE/supabase/.env"
DB="supabase_db_asporto-app"
REST="supabase_rest_asporto-app"
DEMO_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

[ "$(id -u)" = 0 ] || { echo "Esegui come root"; exit 1; }
cd "$BASE"

# Imposta/sostituisce KEY=valore in un file .env senza toccare le altre righe
set_kv() {
  local file="$1" key="$2" value="$3"
  touch "$file"
  if grep -q "^${key}=" "$file"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

echo "1/5 Backup database..."
mkdir -p "$BASE/backups"
BACKUP="$BASE/backups/pre-jwt-$(date +%F-%H%M).sql.gz"
docker exec "$DB" pg_dumpall -U postgres | gzip > "$BACKUP"
chmod 600 "$BACKUP"
echo "    $BACKUP ($(du -h "$BACKUP" | cut -f1))"

echo "2/5 Nuovo secret e riavvio Supabase (1-2 minuti)..."
SECRET=$(grep -s '^SUPABASE_AUTH_JWT_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)
[ -n "$SECRET" ] || SECRET=$(openssl rand -hex 32)
set_kv "$ENV_FILE" SUPABASE_AUTH_JWT_SECRET "$SECRET"
chmod 600 "$ENV_FILE"
export SUPABASE_AUTH_JWT_SECRET="$SECRET"
supabase stop --workdir "$BASE" >/dev/null
supabase start --workdir "$BASE" >/dev/null

STATUS=$(supabase status --workdir "$BASE" -o env 2>/dev/null)
val() { echo "$STATUS" | grep "^$1=" | head -1 | cut -d= -f2- | tr -d '"' || true; }
if [ "$(val JWT_SECRET)" != "$SECRET" ]; then
  echo "ERRORE: Supabase non ha preso il nuovo secret (la CLI non legge SUPABASE_AUTH_JWT_SECRET?)."
  echo "Nessun .env è stato modificato: il gestionale continua a funzionare con le chiavi di prima."
  exit 1
fi
ANON=$(val ANON_KEY)
SERVICE=$(val SERVICE_ROLE_KEY)
[ -n "$ANON" ] && [ -n "$SERVICE" ] || { echo "ERRORE: chiavi non trovate in 'supabase status'"; exit 1; }

echo "3/5 Secret per i token dello staff..."
docker exec -i "$DB" psql -U postgres -q -v ON_ERROR_STOP=1 >/dev/null <<SQL
ALTER DATABASE postgres SET "app.settings.jwt_secret" TO '$SECRET';
SQL
docker restart "$REST" >/dev/null   # PostgREST riapre le connessioni con il nuovo valore

echo "4/5 Nuove chiavi nei .env e rebuild del gestionale..."
set_kv "$BASE/asporto-app/.env" VITE_SUPABASE_ANON_KEY "$ANON"
[ -f "$BASE/asporto-app/print-agent/.env" ] && set_kv "$BASE/asporto-app/print-agent/.env" SUPABASE_ANON_KEY "$ANON"
[ -f "$BASE/telegram-bot/.env" ] && set_kv "$BASE/telegram-bot/.env" SUPABASE_SERVICE_KEY "$SERVICE"
(cd "$BASE/asporto-app" && npm run build >> "$BASE/logs/autopull.log" 2>&1)
systemctl restart risto-print 2>/dev/null || true

echo "5/5 Verifica..."
sleep 3
code() { curl -s -o /dev/null -w '%{http_code}' -H "apikey: $1" -H "Authorization: Bearer ${2:-$1}" "http://127.0.0.1:54321/rest/v1/$3"; }
OLD=$(code "$DEMO_ANON" "" "prodotti?select=id&limit=1")
NEW=$(code "$ANON" "" "prodotti?select=id&limit=1")
STAFF_TOKEN=$(docker exec "$DB" psql -U postgres -tAc "SELECT private.sign_staff_token(id, role) FROM staff_users LIMIT 1")
STAFF=$(code "$ANON" "$STAFF_TOKEN" "ordini?select=id&limit=1")
ANON_ORDINI=$(curl -s -H "apikey: $ANON" "http://127.0.0.1:54321/rest/v1/ordini?select=id&limit=1" | head -c 60)
echo "    vecchia chiave demo:        HTTP $OLD   (atteso 401)"
echo "    nuova chiave pubblica:      HTTP $NEW   (atteso 200)"
echo "    token staff:                HTTP $STAFF   (atteso 200)"
echo "    ordini senza login:         $ANON_ORDINI   (atteso: permission denied)"
if [ "$OLD" = 401 ] && [ "$NEW" = 200 ] && [ "$STAFF" = 200 ]; then
  echo "OK: secret cambiato. Aggiorna l'app sui tablet e rifai il PIN."
else
  echo "ATTENZIONE: qualcosa non torna, guarda i codici sopra. Backup: $BACKUP"
  exit 1
fi
