#!/bin/bash
# =============================================================================
# Risto (Il Girasole) — Setup one-shot per Debian 12 su Proxmox LXC
# =============================================================================
# Eseguire come root nel CT dopo averlo creato.
#
# Requisiti CT Proxmox:
#   - Template: debian-12-standard
#   - RAM: minimo 4096 MB (Supabase/Docker)
#   - Disco: minimo 30 GB
#   - CPU: minimo 2 core
#   - Rete: IP statico sulla LAN del ristorante
#
# Configurazione Proxmox necessaria per Docker nel CT:
#   Opzione A — CT Privilegiato (più semplice):
#     Creare il CT con "Privileged container" spuntato.
#
#   Opzione B — CT Non Privilegiato (più sicuro):
#     Aggiungere in /etc/pve/lxc/<CTID>.conf sul nodo Proxmox:
#       features: keyctl=1,nesting=1
#     Poi riavviare il CT.
#
# Uso:
#   bash setup.sh
# =============================================================================

set -euo pipefail

RISTO_BASE="${RISTO_BASE:-/opt/risto}"
RISTO_REPO="${RISTO_REPO:-https://github.com/Andry018/risto.git}"
NODE_VERSION=20

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERR]${NC}  $*"; exit 1; }

[ "$(id -u)" -eq 0 ] || error "Eseguire come root."

# ---------------------------------------------------------------------------
# 0. SSH — accesso remoto headless (Proxmox senza tastiera/monitor)
# ---------------------------------------------------------------------------
info "Configurazione SSH..."
apt-get update -qq
apt-get install -y -qq openssh-server
systemctl enable --now ssh

# Crea cartella logs all'inizio, usata da tutto il resto
mkdir -p "${RISTO_BASE}/logs" 2>/dev/null || true

# ---------------------------------------------------------------------------
# 1. Dipendenze di sistema
# ---------------------------------------------------------------------------
info "Installazione dipendenze sistema..."
apt-get install -y -qq \
  curl wget git build-essential nginx ca-certificates gnupg lsb-release \
  procps net-tools jq unzip htop nano

# ---------------------------------------------------------------------------
# 2. Node.js 20 via NodeSource
# ---------------------------------------------------------------------------
if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(".")[0])')" -lt "$NODE_VERSION" ]]; then
  info "Installazione Node.js $NODE_VERSION..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
fi
info "Node.js $(node --version), npm $(npm --version)"

# ---------------------------------------------------------------------------
# 3. Docker Engine
# ---------------------------------------------------------------------------
if ! command -v docker &>/dev/null; then
  info "Installazione Docker Engine..."
  OS_ID=$(. /etc/os-release && echo "$ID")   # "debian" o "ubuntu"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${OS_ID}/gpg" \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
     https://download.docker.com/linux/${OS_ID} $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
fi
info "Docker $(docker --version)"

# ---------------------------------------------------------------------------
# 4. Supabase CLI
# ---------------------------------------------------------------------------
if ! command -v supabase &>/dev/null; then
  info "Installazione Supabase CLI..."
  SUPA_VERSION=$(curl -s https://api.github.com/repos/supabase/cli/releases/latest | jq -r .tag_name)
  curl -fsSL "https://github.com/supabase/cli/releases/download/${SUPA_VERSION}/supabase_linux_amd64.tar.gz" \
    | tar -xz -C /usr/local/bin supabase
  chmod +x /usr/local/bin/supabase
fi
info "Supabase $(supabase --version)"

# ---------------------------------------------------------------------------
# 5. Webhook (autopull da GitHub)
# ---------------------------------------------------------------------------
if ! command -v webhook &>/dev/null; then
  info "Installazione webhook (adnanh/webhook)..."
  WH_VERSION=$(curl -s https://api.github.com/repos/adnanh/webhook/releases/latest | jq -r .tag_name)
  curl -fsSL "https://github.com/adnanh/webhook/releases/download/${WH_VERSION}/webhook-linux-amd64.tar.gz" \
    | tar -xz -C /tmp
  mv /tmp/webhook-linux-amd64/webhook /usr/local/bin/webhook
  chmod +x /usr/local/bin/webhook
fi
info "Webhook $(webhook --version 2>&1 | head -1)"

# ---------------------------------------------------------------------------
# 6. Clone / aggiornamento repo
# ---------------------------------------------------------------------------
if [ -d "$RISTO_BASE/.git" ]; then
  info "Repo già presente in $RISTO_BASE — git pull..."
  git -C "$RISTO_BASE" pull
else
  info "Clone repo in $RISTO_BASE..."
  git clone "$RISTO_REPO" "$RISTO_BASE"
fi

# ---------------------------------------------------------------------------
# 7. Dipendenze npm per tutti gli agenti
# ---------------------------------------------------------------------------
info "npm install — asporto-app (frontend + build)..."
cd "$RISTO_BASE/asporto-app"
# Rimuovi lockfile generato su Windows (contiene binari win32 incompatibili)
rm -f package-lock.json
npm install

info "npm install — print-agent..."
cd "$RISTO_BASE/asporto-app/print-agent"
npm install

info "npm install — ecr-agent..."
cd "$RISTO_BASE/asporto-app/ecr-agent"
npm install

# ---------------------------------------------------------------------------
# 8. Prima build del frontend
# ---------------------------------------------------------------------------
info "Prima build Vite del frontend..."
cd "$RISTO_BASE/asporto-app"
git -C "$RISTO_BASE" rev-parse HEAD > public/version.txt
echo "builtAt=$(date -Iseconds)" >> public/version.txt
npm run build

# ---------------------------------------------------------------------------
# 9. Nginx — configurazione
# ---------------------------------------------------------------------------
info "Configurazione Nginx..."
cp "$RISTO_BASE/linux/nginx.conf" /etc/nginx/nginx.conf
cp "$RISTO_BASE/linux/proxy_supabase.conf" /etc/nginx/proxy_supabase.conf
# Rimuovi sito di default Debian
rm -f /etc/nginx/sites-enabled/default /etc/nginx/sites-available/default
nginx -t && systemctl enable nginx && systemctl restart nginx

# ---------------------------------------------------------------------------
# 10. Supabase — primo avvio e migrazioni
# ---------------------------------------------------------------------------
info "Avvio Supabase (potrebbe richiedere qualche minuto al primo avvio)..."
cd "$RISTO_BASE"
supabase start

info "Applicazione migrazioni database..."
supabase db push || warn "Errore migrazioni — verificare manualmente con 'supabase db push'"

# ---------------------------------------------------------------------------
# 11. File di configurazione .env (agenti)
# ---------------------------------------------------------------------------
SUPA_URL=$(supabase status --output json 2>/dev/null | jq -r '.API_URL // "http://127.0.0.1:54321"')
SUPA_KEY=$(supabase status --output json 2>/dev/null | jq -r '.ANON_KEY // ""')

for AGENT_DIR in print-agent ecr-agent; do
  ENV_FILE="$RISTO_BASE/asporto-app/$AGENT_DIR/.env"
  if [ ! -f "$ENV_FILE" ]; then
    cp "${ENV_FILE}.example" "$ENV_FILE"
    sed -i "s|http://127.0.0.1:54321|${SUPA_URL}|g" "$ENV_FILE"
    info "$AGENT_DIR/.env creato. Verifica PAX_HOST, CUSTOM_HOST, PRINTER_INTERFACE..."
  else
    info "$AGENT_DIR/.env già presente — skip."
  fi
done

# .env frontend
FRONTEND_ENV="$RISTO_BASE/asporto-app/.env"
if [ ! -f "$FRONTEND_ENV" ]; then
  cat > "$FRONTEND_ENV" <<EOF
VITE_SUPABASE_URL=${SUPA_URL}
VITE_SUPABASE_ANON_KEY=${SUPA_KEY}
EOF
  info "asporto-app/.env creato."
fi

# Admin server secrets
SECRETS_FILE="$RISTO_BASE/admin-server/secrets.env"
if [ ! -f "$SECRETS_FILE" ]; then
  RANDOM_SECRET=$(openssl rand -hex 24)
  echo "ADMIN_SECRET=${RANDOM_SECRET}" > "$SECRETS_FILE"
  echo "RISTO_BASE=${RISTO_BASE}" >> "$SECRETS_FILE"
  warn "ADMIN_SECRET generato automaticamente: ${RANDOM_SECRET}"
  warn "Annotarlo — serve nella pagina 'Pannello Sistema' della webapp."
fi

# ---------------------------------------------------------------------------
# 12. Systemd services
# ---------------------------------------------------------------------------
info "Installazione servizi systemd..."
for SVC in risto-admin risto-print risto-ecr risto-webhook; do
  cp "$RISTO_BASE/linux/services/${SVC}.service" /etc/systemd/system/
done

systemctl daemon-reload
systemctl enable risto-admin risto-print risto-ecr risto-webhook
systemctl start  risto-admin risto-print risto-ecr risto-webhook

# ---------------------------------------------------------------------------
# Fine
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}  RISTO — Setup completato!${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""
echo "  Gestionale:  http://$(hostname -I | awk '{print $1}')"
echo "  Supabase:    http://$(hostname -I | awk '{print $1}'):54323  (Studio)"
echo ""
echo "  Accesso remoto (headless — nessuna tastiera/monitor necessaria):"
echo "  - SSH:           ssh root@$(hostname -I | awk '{print $1}')"
echo "  - Proxmox noVNC: aprire Proxmox web UI → CT → Console"
echo ""
echo "  Prossimi passi:"
echo "  1. Configurare $RISTO_BASE/asporto-app/print-agent/.env  (IP stampante)"
echo "  2. Configurare $RISTO_BASE/asporto-app/ecr-agent/.env    (IP PAX A35 + Custom)"
echo "  3. Verificare $RISTO_BASE/admin-server/secrets.env        (ADMIN_SECRET)"
echo "  4. (Opzionale) Certificato SSL: apt install certbot python3-certbot-nginx"
echo "                                   certbot --nginx -d <dominio>"
echo ""
echo "  Comandi utili:"
echo "  systemctl status risto-admin risto-print risto-ecr risto-webhook"
echo "  journalctl -fu risto-print     # log stampa in tempo reale"
echo "  tail -f $RISTO_BASE/logs/autopull.log"
echo ""
