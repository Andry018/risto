# Deploy Locale — Risto (IL GIRASOLE)

Guida completa per mettere in produzione l'intero sistema su un PC Windows o Linux
in locale (rete LAN del ristorante), con Supabase eseguito via Docker.

---

## Indice

1. [Architettura](#1-architettura)
2. [Prerequisiti](#2-prerequisiti)
3. [Supabase locale (Docker)](#3-supabase-locale-docker)
4. [Backend Print Agent](#4-backend-print-agent)
5. [Frontend (Vite / React)](#5-frontend-vite--react)
6. [Nginx — Proxy & HTTPS locale](#6-nginx--proxy--https-locale)
7. [Avvio automatico (servizi)](#7-avvio-automatico-servizi)
8. [Dump & Ripristino DB](#8-dump--ripristino-db)
9. [Checklist finale](#9-checklist-finale)

---

## 1. Architettura

```
┌──────────────────────────────────────────────────────────────────┐
│                        PC Server (192.168.1.X)                   │
│                                                                  │
│  ┌────────────┐    ┌──────────────────┐    ┌────────────────┐   │
│  │  Nginx      │───▶│  Supabase        │    │  Print Agent   │   │
│  │  (porta 80) │    │  (Docker)        │    │  (porta 8787)  │   │
│  │  HTTPS 443  │    │  Kong:8000       │    │  Node/Express  │   │
│  │             │    │  DB:5432         │    │                │   │
│  └─────┬──────┘    │  Studio:8083     │    └────────────────┘   │
│        │           └──────────────────┘                          │
│  ┌─────▼──────┐    ┌──────────────────┐                          │
│  │  Frontend   │    │  Stampante LAN   │                          │
│  │  (Vite SPA) │    │  (IP statico     │                          │
│  │  /var/www   │    │   porta 9100)    │                          │
│  └────────────┘    └──────────────────┘                          │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│            Tablet / PC cassa (stesso VLAN)                       │
│  ─── http://server-ip ───> App completa via browser              │
└──────────────────────────────────────────────────────────────────┘
```

| Componente | Porta | Ruolo |
|---|---|---|
| Nginx | 80 / 443 | Reverse proxy, servire frontend, SSL |
| Kong | 8000 | API Gateway Supabase (PostgREST + Auth) |
| PostgreSQL | 5432 | Database |
| Supabase Studio | 8083 | Admin UI web per il DB |
| Print Agent | 8787 | Proxy HTTP → stampante ESC/POS |
| Stampante LAN | 9100 | Stampica termica (raw TCP) |

---

## 2. Prerequisiti

### Windows

```powershell
# 1. Docker Desktop
winget install Docker.DockerDesktop
# Dopo l'installazione, avvia Docker Desktop manualmente e verifica:
docker --version
docker compose version

# 2. Node.js 20 LTS
winget install OpenJS.NodeJS.LTS
# (se vuoi una versione specifica: winget install OpenJS.NodeJS.LTS --version 20.18.0)
node -v

# 3. Git
winget install Git.Git
git --version

# 4. Nginx
winget install nginx.nginx
# Oppure via Docker: docker run --name nginx -p 80:80 nginx
```

### Linux (Debian/Ubuntu 22.04+)

```bash
# Tutto in un colpo
curl -fsSL https://get.docker.com | sudo bash
sudo usermod -aG docker $USER && newgrp docker
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx

# Verifica
node -v    # >= 20
npm -v
docker --version
docker compose version
nginx -v
```

---

## 3. Supabase locale (Docker)

### 3.1 — Installazione Supabase CLI (opzionale ma consigliato)

```bash
# Linux
sudo apt install -y supabase 2>/dev/null || (
  wget -q https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.deb -O /tmp/supabase.deb
  sudo dpkg -i /tmp/supabase.deb
)
supabase --version 2>/dev/null || echo "CLI opzionale, prosegui con Docker Compose"

# Windows (PowerShell)
winget install Supabase.cli 2>$null
# Verifica: supabase --version
```

### 3.2 — Avvio Supabase con Docker Compose

Crea la cartella del progetto (se non esiste già una `supabase/` nella root
del progetto risto):

```bash
cd /opt/risto
mkdir -p supabase
```

Crea `supabase/docker-compose.yml`:

```yaml
services:
  kong:
    image: supabase/gateway:latest
    ports:
      - "8000:8000"
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yml
    volumes:
      - ./kong.yml:/etc/kong/kong.yml:ro

  auth:
    image: supabase/gotrue:latest
    environment:
      GOTRUE_API_HOST: "0.0.0.0"
      GOTRUE_SITE_URL: "http://192.168.1.50"
      GOTRUE_JWT_SECRET: "jwt-secret-super-sicuro-cambiami"
      GOTRUE_DB_DRIVER: "postgres"
      GOTRUE_DB_DATABASE_URL: "postgres://supabase_user:supabase_pass@db:5432/postgres"
    depends_on: [db]

  rest:
    image: supabase/postgrest:latest
    ports:
      - "3000:3000"
    environment:
      PGRST_DB_URI: "postgres://supabase_user:supabase_pass@db:5432/postgres"
      PGRST_DB_SCHEMA: "public"
      PGRST_DB_ANON_ROLE: "anon"
      PGRST_JWT_SECRET: "jwt-secret-super-sicuro-cambiami"
    depends_on: [db]

  db:
    image: supabase/postgres:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: "supabase_user"
      POSTGRES_PASSWORD: "supabase_pass"
      POSTGRES_DB: "postgres"
    volumes:
      - ./data:/var/lib/postgresql/data

  studio:
    image: supabase/studio:latest
    ports:
      - "8083:8083"
    environment:
      STUDIO_PG_META_URL: "http://meta:8080"
    depends_on: [meta]

  meta:
    image: supabase/pg-meta:latest
    environment:
      PG_META_DB_URL: "postgres://supabase_user:supabase_pass@db:5432/postgres"
    depends_on: [db]
```

Crea `supabase/kong.yml` (configurazione route):

```yaml
_format_version: "1.1"
services:
  - name: rest
    url: http://rest:3000
    routes:
      - name: rest-all
        paths:
          - /rest/v1/
  - name: auth
    url: http://auth:9999
    routes:
      - name: auth-all
        paths:
          - /auth/v1/
```

### 3.3 — Avvio dei container

```bash
cd supabase
docker compose up -d
docker compose ps
# Tutti i container devono essere "Up"
```

Se funziona, Kong (API gateway Supabase) sarà in ascolto su `localhost:8000`.
Le API sono raggiungibili a:
- Database REST: `http://localhost:8000/rest/v1/`
- Studio: `http://localhost:8083`

### 3.4 — Creazione tabelle

Apri Supabase Studio su `http://localhost:8083`, vai su **SQL Editor** ed
esegui lo schema del progetto. Se non hai lo schema separato, importa un
dump seguendo la [sezione 8](#8-dump--ripristino-db).

Oppure via psql:

```bash
# Connettiti al database Supabase locale
psql -h localhost -U supabase_user -d postgres

# Incolla le CREATE TABLE del progetto
\i /opt/risto/docs/schema.sql
```

> **Nota:** La password è `supabase_pass` (come da docker-compose sopra).

### 3.5 — Ruolo anonimo

Assicurati che il ruolo `anon` esista e abbia i permessi necessari:

```sql
CREATE ROLE anon WITH LOGIN NOINHERIT;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
```

---

## 4. Backend Print Agent

Il Print Agent traduce le richieste HTTP del frontend in comandi TCP raw
per la stampante termica ESC/POS.

### 4.1 — Installazione

```bash
cd /opt/risto
mkdir -p print-agent
cd print-agent
npm init -y
npm install express net
```

### 4.2 — Codice del Print Agent

Crea `print-agent/server.js`:

```javascript
const express = require('express');
const net = require('net');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/print', (req, res) => {
  const { printerIp, printerPort = 9100 } = req.body;
  if (!printerIp) return res.status(400).json({ error: 'printerIp required' });

  const text = formatKitchenTicket(req.body);
  const client = new net.Socket();

  client.connect(printerPort, printerIp, () => {
    client.write(Buffer.from(text, 'latin1'));
    client.destroy();
    res.json({ printed: true });
  });

  client.on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

function formatKitchenTicket({ tableName, orderTime, items }) {
  let out = '';
  out += '\x1B\x40';          // Initialize printer
  out += '\x1B\x61\x01';      // Center align
  out += `${tableName}\n`;
  out += `${orderTime || ''}\n`;
  out += '\x1B\x61\x00';      // Left align
  out += `${'─'.repeat(32)}\n`;
  for (const item of items) {
    out += `${item.quantity}x ${item.nome.toUpperCase()}\n`;
    if (item.addedIngredients?.length) {
      out += `  + ${item.addedIngredients.map(a => a.nome).join(', ')}\n`;
    }
    if (item.removedIngredients?.length) {
      out += `  - ${item.removedIngredients.join(', ')}\n`;
    }
    if (item.notes) out += `  NOTE: ${item.notes}\n`;
  }
  out += `${'─'.repeat(32)}\n`;
  out += '\x1B\x61\x01';
  out += 'GRAZIE\n';
  out += '\x1B\x64\x04';      // Feed 4 lines
  out += '\x1D\x56\x00';      // Cut paper
  return out;
}

app.listen(8787, () => {
  console.log('Print Agent on port 8787');
});
```

### 4.3 — Avvio

```bash
# Manuale
node server.js

# Con systemd (Linux)
sudo tee /etc/systemd/system/print-agent.service << 'EOF'
[Unit]
Description=Risto Print Agent
After=network.target

[Service]
ExecStart=/usr/bin/node /opt/risto/print-agent/server.js
WorkingDirectory=/opt/risto/print-agent
Restart=always
User=root

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now print-agent
```

**Windows**: avvia `node server.js` dentro `C:\risto\print-agent\`.
Per eseguirlo come servizio Windows, usa [NSSM](https://nssm.cc/):

```powershell
nssm install RistoPrintAgent "C:\Program Files\nodejs\node.exe" "C:\risto\print-agent\server.js"
nssm start RistoPrintAgent
```

### 4.4 — Verifica

```bash
curl http://localhost:8787/health
# → {"status":"ok"}

curl -X POST http://localhost:8787/print \
  -H "Content-Type: application/json" \
  -d '{"tableName":"TEST","printerIp":"192.168.1.100","items":[{"nome":"Acqua","quantity":1}]}'
```

---

## 5. Frontend (Vite / React)

### 5.1 — File `.env`

Crea `asporto-app/.env.production`:

```env
# ─── Database (Supabase locale via Kong) ─────────────────────────
VITE_SUPABASE_URL=http://192.168.1.50:8000/rest/v1
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0

# ─── Stampante ────────────────────────────────────────────────────
VITE_PRINT_AGENT_URL=http://192.168.1.50:8787
VITE_PRINTER_IP=192.168.1.100
VITE_PRINTER_PORT=9100

# ─── Staff Pin (opzionale) ──────────────────────────────────────
VITE_STAFF_PIN=1234
```

> **Nota sulla chiave anonima:** L'anon key di default per Supabase locale
> è sempre quella sopra (la stessa per tutti). Per verificarla:
> ```bash
> curl -s http://localhost:8083 | grep -o '"anonKey":"[^"]*"'
> ```

Se vuoi usare Nginx come reverse proxy unico (consigliato, vedi sezione 6),
usa invece:

```env
VITE_SUPABASE_URL=http://192.168.1.50/rest/v1
VITE_PRINT_AGENT_URL=http://192.168.1.50/print-agent
```

### 5.2 — Build

```bash
cd asporto-app
npm install
npm run build    # output in /dist
```

### 5.3 — Deploy su Nginx

```bash
# Linux
sudo cp -r dist/* /var/www/risto/
sudo chown -R www-data:www-data /var/www/risto/

# Windows: copia dist\ in C:\nginx\html\risto\
```

---

## 6. Nginx — Proxy & HTTPS locale

### 6.1 — Configurazione Linux

Crea `/etc/nginx/sites-available/risto`:

```nginx
server {
    listen 80;
    server_name risto.local;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name risto.local;

    ssl_certificate     /etc/nginx/ssl/risto.crt;
    ssl_certificate_key /etc/nginx/ssl/risto.key;

    root /var/www/risto;
    index index.html;

    # SPA — tutte le route al index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy per Supabase API (Kong)
    location /rest/ {
        proxy_pass http://127.0.0.1:8000/rest/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:8000/auth/;
        proxy_set_header Host $host;
    }

    # Proxy per Print Agent
    location /print-agent/ {
        rewrite ^/print-agent/(.*) /$1 break;
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
    }
}
```

**Genera certificato SSL self-signed:**

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/risto.key \
  -out /etc/nginx/ssl/risto.crt \
  -subj "/CN=risto.local"
```

**Attiva il sito:**

```bash
sudo ln -s /etc/nginx/sites-available/risto /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### 6.2 — Configurazione Windows

```nginx
# C:\nginx\conf\nginx.conf

worker_processes  1;
events {
    worker_connections  1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;

    server {
        listen       80;
        server_name  localhost;

        root   C:\nginx\html\risto;
        index  index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /rest/ {
            proxy_pass http://127.0.0.1:8000/rest/;
        }

        location /auth/ {
            proxy_pass http://127.0.0.1:8000/auth/;
        }

        location /print-agent/ {
            rewrite ^/print-agent/(.*) /$1 break;
            proxy_pass http://127.0.0.1:8787;
        }
    }
}
```

---

## 7. Avvio automatico (servizi)

### Linux (systemd)

Crea un target unico per gestire tutto insieme:

```bash
sudo tee /etc/systemd/system/risto.target << 'EOF'
[Unit]
Description=Risto Restaurant System
Wants=docker.service print-agent.service nginx.service
After=network.target docker.service
EOF

# Abilita Docker all'avvio (se non già fatto)
sudo systemctl enable docker

# Abilita Supabase (via Docker) — configura Docker per restart automatico
docker update --restart=unless-stopped $(docker ps -q)

# Abilita Print Agent e Nginx
sudo systemctl enable print-agent nginx
```

Per avviare/fermare tutto:

```bash
sudo systemctl start risto.target
sudo systemctl stop risto.target
```

### Windows (PowerShell)

```powershell
# Crea C:\risto\start-all.ps1
@"
# Avvia Supabase (Docker Desktop deve essere avviato)
cd C:\risto\supabase
docker compose up -d

# Avvia Print Agent
Start-Process "node" -ArgumentList "C:\risto\print-agent\server.js" -WindowStyle Hidden

# Avvia Nginx
Start-Process "C:\nginx\nginx.exe" -WindowStyle Hidden
"@ | Out-File -FilePath "C:\risto\start-all.ps1" -Encoding UTF8

# Aggiungi a startup
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\Risto.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\risto\start-all.ps1"
$Shortcut.Save()
```

> **Importante:** Docker Desktop su Windows deve essere configurato per
> avviarsi automaticamente all'accesso (Settings → General → Start
> Docker Desktop when you log in).

---

## 8. Dump & Ripristino DB

### 8.1 — Eseguire dump del database Supabase locale

```bash
# Il database Supabase è accessibile via psql sulla porta 5432
pg_dump -h localhost -U supabase_user -d postgres \
  --schema=public \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=risto_backup.dump
```

Per un dump SQL puro (leggibile):

```bash
pg_dump -h localhost -U supabase_user -d postgres \
  --schema=public \
  --no-owner \
  --no-acl \
  --file=risto_backup.sql
```

### 8.2 — Eseguire dump da Supabase cloud (migrazione)

Se hai un Supabase cloud e vuoi spostare tutto in locale:

```bash
# Ottieni i parametri di connessione da:
# Supabase Dashboard → Project Settings → Database → Connection string
pg_dump --host=db.xxxxxx.supabase.co \
        --port=5432 \
        --username=postgres \
        --dbname=postgres \
        --schema=public \
        --no-owner \
        --no-acl \
        --format=custom \
        --file=risto_cloud.dump
```

### 8.3 — Ripristino dump su Supabase locale

```bash
# Da formato custom
pg_restore -h localhost -U supabase_user -d postgres \
  --no-owner --no-acl \
  --clean \
  risto_backup.dump

# Da formato SQL
psql -h localhost -U supabase_user -d postgres < risto_backup.sql
```

> **Nota:** `--clean` droppa e ricrea le tabelle. Se vuoi solo caricare
> dati senza toccare la struttura, usa `--data-only`.

### 8.4 — Backup automatico (Linux cron)

```bash
sudo tee /etc/cron.daily/risto-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/risto"
mkdir -p "$BACKUP_DIR"
DATE=$(date +%Y%m%d_%H%M)
PGPASSWORD="supabase_pass" pg_dump -h localhost -U supabase_user -d postgres \
  --format=custom \
  --file="$BACKUP_DIR/risto_$DATE.dump"
# Cancella backup più vecchi di 30 giorni
find "$BACKUP_DIR" -name "*.dump" -mtime +30 -delete
EOF

sudo chmod +x /etc/cron.daily/risto-backup
```

### 8.5 — Backup automatico (Windows Task Scheduler)

```powershell
# C:\risto\backup.ps1
$backupDir = "C:\backups\risto"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force }
$date = Get-Date -Format "yyyyMMdd_HHmm"
$env:PGPASSWORD = "supabase_pass"
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -h localhost -U supabase_user -d postgres `
  --format=custom --file="$backupDir\risto_$date.dump"

# Mantieni solo 30 giorni
Get-ChildItem $backupDir -Filter *.dump | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

Programma con Task Scheduler:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -File C:\risto\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 04:00
Register-ScheduledTask -TaskName "Risto Backup DB" -Action $action -Trigger $trigger
```

> **Nota:** I comandi `pg_dump` e `psql` su Windows richiedono
> PostgreSQL client installato o l'estrazione da
> `C:\Program Files\PostgreSQL\16\bin\`. Se non hai PostgreSQL
> installato in Windows (è dentro Docker), puoi usare Docker per
> eseguire pg_dump:
>
> ```powershell
> docker run --rm -v C:\backups\risto:/backup postgres:16 `
>   pg_dump -h host.docker.internal -U supabase_user -d postgres `
>   --file=/backup/risto_$date.dump
> ```
>
> `host.docker.internal` è l'IP del tuo PC Windows visto da un container.

---

## 9. Checklist finale

Prima di andare live:

- [ ] Docker Desktop o Docker Engine avviato e funzionante
- [ ] Container Supabase tutti "Up": `docker compose ps` (dentro `supabase/`)
- [ ] Kong risponde: `curl http://localhost:8000/rest/v1/`
- [ ] Supabase Studio accessibile: `http://localhost:8083`
- [ ] Tabelle create nel DB (via Studio o dump)
- [ ] Ruolo `anon` configurato con permessi
- [ ] Print Agent funziona: `curl http://localhost:8787/health`
- [ ] Stampante ha IP statico (DHCP reservation sul router)
- [ ] `.env.production` ha gli IP corretti (server, stampante)
- [ ] Frontend buildato: `npm run build` in `asporto-app/`
- [ ] Frontend servito da Nginx o direttamente
- [ ] Nginx test passato: `nginx -t`
- [ ] Tablet può raggiungere il server: `ping 192.168.1.50`
- [ ] Backup automatico configurato (cron / Task Scheduler)
- [ ] Firewall: porta 80/443 aperta solo sulla LAN

### Test finale dal tablet

```bash
# Apri browser sul tablet → http://192.168.1.50
# 1. Verifica che la dashboard carichi
# 2. Apri un tavolo in POS
# 3. Aggiungi un prodotto al carrello
# 4. Premi "STAMPA COMANDA" — deve stampare sulla termica
# 5. Verifica che il salvataggio su database funzioni
```

---

## Troubleshooting

### Container Supabase non partono

```bash
docker compose logs
# Controlla errori di porta già in uso (8000, 5432, 8083)
# Cambia porta in docker-compose.yml se necessario
```

### Kong restituisce 404

```bash
# Verifica che Kong sia configurato correttamente
curl -v http://localhost:8000/rest/v1/
# Dovrebbe rispondere con JSON (anche se errore di autenticazione)
# Se 404, controlla kong.yml
```

### Stampante non stampa

```bash
# Test diretto TCP (sostituisci con IP della stampante)
echo -e "Test di stampa\n\n\n" | nc -w 3 192.168.1.100 9100

# Se nc non funziona (Windows):
# Usa PowerShell: 
#   $tcp = New-Object System.Net.Sockets.TcpClient('192.168.1.100', 9100)
#   $stream = $tcp.GetStream()
#   $data = [Text.Encoding]::ASCII.GetBytes("Test`n`n`n")
#   $stream.Write($data, 0, $data.Length)
#   $stream.Close()

# Test via Print Agent:
curl -X POST http://localhost:8787/print \
  -H "Content-Type: application/json" \
  -d '{"tableName":"TEST","printerIp":"192.168.1.100","items":[{"nome":"Prova","quantity":1}]}'
```

### Frontend non carica (pagina bianca)

```bash
# Apri console del browser (F12)
# Controlla che le chiamate a /rest/v1/ e /print-agent/ arrivino al server
# Verifica che i proxy Nginx siano configurati
# Controlla che VITE_SUPABASE_URL punti al Kong (porta 8000) o al proxy Nginx
```

### Come trovare l'anon key di Supabase locale

```bash
# Opzione 1 — dalla console di Supabase Studio
# Vai a http://localhost:8083 → Settings → API → Project API key → anon public

# Opzione 2 — dal container Kong
docker exec supabase-kong-1 cat /etc/kong/kong.yml | grep -A5 anon

# Opzione 3 — quella di default per sviluppo locale
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```
