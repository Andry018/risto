# Deploy Locale — Risto (IL GIRASOLE)

Guida completa per installare il sistema su un **PC Windows** (server in
rete LAN del ristorante), con Supabase eseguito via Docker. I comandi Linux
sono indicati come alternativa tra parentesi `(Linux: ...)`.

\---

## Indice

1. [Architettura](#1-architettura)
2. [Prerequisiti](#2-prerequisiti)
3. [Supabase locale (Docker)](#3-supabase-locale-docker)
4. [Backend Print Agent](#4-backend-print-agent)
5. [Frontend (Vite / React)](#5-frontend-vite--react)
6. [Nginx — Proxy \& HTTPS locale](#6-nginx--proxy--https-locale)
7. [Avvio automatico (servizi)](#7-avvio-automatico-servizi)
8. [Dump \& Ripristino DB](#8-dump--ripristino-db)
9. [Auto-update da Git](#9-auto-update-da-git)
10. [Checklist finale](#10-checklist-finale)

\---

## 1\. Architettura

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

|Componente|Porta|Ruolo|
|-|-|-|
|Nginx|80 / 443|Reverse proxy, servire frontend, SSL|
|Kong|8000|API Gateway Supabase (PostgREST + Auth)|
|PostgreSQL|5432|Database|
|Supabase Studio|8083|Admin UI web per il DB|
|Print Agent|8787|Proxy HTTP → stampante ESC/POS|
|Stampante LAN|9100|Stampica termica (raw TCP)|

\---

## 2\. Prerequisiti

### Windows

Apri **PowerShell come amministratore** ed esegui:

```powershell
# 1. Docker Desktop
winget install Docker.DockerDesktop
# Dopo l'installazione, avvia Docker Desktop dal menu Start e verifica:
docker --version
docker compose version

# 2. Node.js 20 LTS
winget install OpenJS.NodeJS.LTS
node -v

# 3. Git
winget install Git.Git
git --version

# 4. Nginx
winget install nginx.nginx
```

(Linux: `curl -fsSL https://get.docker.com | sudo bash \\\&\\\& sudo apt install -y nodejs git nginx`)

\---

## 3\. Supabase locale (Docker)

### 3.1 — Installazione Supabase CLI (opzionale)

```powershell
# Windows (PowerShell)
winget install Supabase.cli
supabase --version
```

(Linux: `sudo snap install supabase --classic` o scarica il .deb da GitHub)

### 3.2 — Avvio Supabase con Docker Compose

Crea la cartella `supabase/` nella root del progetto:

```powershell
# Windows
cd C:\\\\risto
mkdir supabase

# (Linux: mkdir -p /opt/risto/supabase)
```

Crea `supabase/docker-compose.yml`:

```yaml
services:
  kong:
    image: supabase/gateway:latest
    ports:
      - "8000:8000"
    environment:
      KONG\\\_DATABASE: "off"
      KONG\\\_DECLARATIVE\\\_CONFIG: /etc/kong/kong.yml
    volumes:
      - ./kong.yml:/etc/kong/kong.yml:ro

  auth:
    image: supabase/gotrue:latest
    environment:
      GOTRUE\\\_API\\\_HOST: "0.0.0.0"
      GOTRUE\\\_SITE\\\_URL: "http://192.168.1.50"
      GOTRUE\\\_JWT\\\_SECRET: "jwt-secret-super-sicuro-cambiami"
      GOTRUE\\\_DB\\\_DRIVER: "postgres"
      GOTRUE\\\_DB\\\_DATABASE\\\_URL: "postgres://supabase\\\_user:supabase\\\_pass@db:5432/postgres"
    depends\\\_on: \\\[db]

  rest:
    image: supabase/postgrest:latest
    ports:
      - "3000:3000"
    environment:
      PGRST\\\_DB\\\_URI: "postgres://supabase\\\_user:supabase\\\_pass@db:5432/postgres"
      PGRST\\\_DB\\\_SCHEMA: "public"
      PGRST\\\_DB\\\_ANON\\\_ROLE: "anon"
      PGRST\\\_JWT\\\_SECRET: "jwt-secret-super-sicuro-cambiami"
    depends\\\_on: \\\[db]

  db:
    image: supabase/postgres:latest
    ports:
      - "5432:5432"
    environment:
      POSTGRES\\\_USER: "supabase\\\_user"
      POSTGRES\\\_PASSWORD: "supabase\\\_pass"
      POSTGRES\\\_DB: "postgres"
    volumes:
      - ./data:/var/lib/postgresql/data

  studio:
    image: supabase/studio:latest
    ports:
      - "8083:8083"
    environment:
      STUDIO\\\_PG\\\_META\\\_URL: "http://meta:8080"
    depends\\\_on: \\\[meta]

  meta:
    image: supabase/pg-meta:latest
    environment:
      PG\\\_META\\\_DB\\\_URL: "postgres://supabase\\\_user:supabase\\\_pass@db:5432/postgres"
    depends\\\_on: \\\[db]
```

Crea `supabase/kong.yml` (configurazione route):

```yaml
\\\_format\\\_version: "1.1"
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

```powershell
cd C:\\\\risto\\\\supabase
docker compose up -d
docker compose ps
# Tutti i container devono essere "Up"
```

(Linux: stesso comando, `docker compose up -d` dentro la cartella)

Se funziona, Kong (API gateway Supabase) sarà in ascolto su `localhost:8000`.
Le API sono raggiungibili a:

* Database REST: `http://localhost:8000/rest/v1/`
* Studio: `http://localhost:8083`

### 3.4 — Creazione tabelle

Apri Supabase Studio su `http://localhost:8083`, vai su **SQL Editor** ed
esegui lo schema del progetto. Se non hai lo schema separato, importa un
dump seguendo la [sezione 8](#8-dump--ripristino-db).

Oppure via psql:

```powershell
# Connettiti al database Supabase locale (usa lo stesso terminale PowerShell)
docker exec -it supabase-db-1 psql -U supabase\\\_user -d postgres
# Incolla le CREATE TABLE del progetto
```

> \\\*\\\*Nota:\\\*\\\* La password è `supabase\\\_pass` (come da docker-compose sopra).

### 3.5 — Ruolo anonimo

Assicurati che il ruolo `anon` esista e abbia i permessi necessari:

```sql
CREATE ROLE anon WITH LOGIN NOINHERIT;
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon;
```

\---

## 4\. Backend Print Agent

Il Print Agent traduce le richieste HTTP del frontend in comandi TCP raw
per la stampante termica ESC/POS.

### 4.1 — Installazione

```powershell
cd C:\\\\risto
mkdir print-agent
cd print-agent
npm init -y
npm install express net
```

(Linux: stessi comandi, percorso `/opt/risto/print-agent`)

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
  out += '\\\\x1B\\\\x40';          // Initialize printer
  out += '\\\\x1B\\\\x61\\\\x01';      // Center align
  out += `${tableName}\\\\n`;
  out += `${orderTime || ''}\\\\n`;
  out += '\\\\x1B\\\\x61\\\\x00';      // Left align
  out += `${'─'.repeat(32)}\\\\n`;
  for (const item of items) {
    out += `${item.quantity}x ${item.nome.toUpperCase()}\\\\n`;
    if (item.addedIngredients?.length) {
      out += `  + ${item.addedIngredients.map(a => a.nome).join(', ')}\\\\n`;
    }
    if (item.removedIngredients?.length) {
      out += `  - ${item.removedIngredients.join(', ')}\\\\n`;
    }
    if (item.notes) out += `  NOTE: ${item.notes}\\\\n`;
  }
  out += `${'─'.repeat(32)}\\\\n`;
  out += '\\\\x1B\\\\x61\\\\x01';
  out += 'GRAZIE\\\\n';
  out += '\\\\x1B\\\\x64\\\\x04';      // Feed 4 lines
  out += '\\\\x1D\\\\x56\\\\x00';      // Cut paper
  return out;
}

app.listen(8787, () => {
  console.log('Print Agent on port 8787');
});
```

### 4.3 — Avvio come servizio Windows

Installa [NSSM](https://nssm.cc/) (Non-Sucking Service Manager):

```powershell
winget install nssm
```

Poi registra il Print Agent come servizio:

```powershell
nssm install RistoPrintAgent "C:\\\\Program Files\\\\nodejs\\\\node.exe" "C:\\\\risto\\\\print-agent\\\\server.js"
nssm set RistoPrintAgent Start SERVICE\\\_AUTO\\\_START
nssm start RistoPrintAgent
```

(Linux: `sudo tee /etc/systemd/system/print-agent.service ... \\\&\\\& sudo systemctl enable --now print-agent`)

### 4.4 — Verifica

```bash
curl http://localhost:8787/health
# → {"status":"ok"}

curl -X POST http://localhost:8787/print \\\\
  -H "Content-Type: application/json" \\\\
  -d '{"tableName":"TEST","printerIp":"192.168.1.100","items":\\\[{"nome":"Acqua","quantity":1}]}'
```

\---

## 5\. Frontend (Vite / React)

### 5.1 — File `.env`

Crea `asporto-app/.env.production`:

```env
# ─── Database (Supabase locale via Kong) ─────────────────────────
VITE\\\_SUPABASE\\\_URL=http://192.168.1.50:8000/rest/v1
VITE\\\_SUPABASE\\\_ANON\\\_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn\\\_I0

# ─── Stampante ────────────────────────────────────────────────────
VITE\\\_PRINT\\\_AGENT\\\_URL=http://192.168.1.50:8787
VITE\\\_PRINTER\\\_IP=192.168.1.100
VITE\\\_PRINTER\\\_PORT=9100

# ─── Staff Pin (opzionale) ──────────────────────────────────────
VITE\\\_STAFF\\\_PIN=1234
```

> \\\*\\\*Nota sulla chiave anonima:\\\*\\\* L'anon key di default per Supabase locale
> è sempre quella sopra (la stessa per tutti). Per verificarla:
> ```bash
> curl -s http://localhost:8083 | grep -o '"anonKey":"\\\[^"]\\\*"'
> ```

Se vuoi usare Nginx come reverse proxy unico (consigliato, vedi sezione 6),
usa invece:

```env
VITE\\\_SUPABASE\\\_URL=http://192.168.1.50/rest/v1
VITE\\\_PRINT\\\_AGENT\\\_URL=http://192.168.1.50/print-agent
```

### 5.2 — Build \& Deploy

```powershell
cd C:\\\\risto\\\\asporto-app
npm install
npm run build

# Copia i file nella cartella servita da Nginx
Copy-Item -Path "dist\\\\\\\*" -Destination "C:\\\\nginx\\\\html\\\\risto" -Recurse -Force
```

(Linux: `cp -r dist/\\\* /var/www/risto/`)

\---

## 6\. Nginx — Proxy \& HTTPS locale

### 6.1 — Configurazione Windows

Modifica `C:\\\\nginx\\\\conf\\\\nginx.conf`:

```nginx
worker\\\_processes  1;
events {
    worker\\\_connections  1024;
}

http {
    include       mime.types;
    default\\\_type  application/octet-stream;

    server {
        listen       80;
        server\\\_name  localhost;

        root   C:\\\\nginx\\\\html\\\\risto;
        index  index.html;

        location / {
            try\\\_files $uri $uri/ /index.html;
        }

        # Proxy per Supabase API (Kong)
        location /rest/ {
            proxy\\\_pass http://127.0.0.1:8000/rest/;
            proxy\\\_set\\\_header Host $host;
        }

        location /auth/ {
            proxy\\\_pass http://127.0.0.1:8000/auth/;
            proxy\\\_set\\\_header Host $host;
        }

        # Proxy per Print Agent
        location /print-agent/ {
            rewrite ^/print-agent/(.\\\*) /$1 break;
            proxy\\\_pass http://127.0.0.1:8787;
            proxy\\\_set\\\_header Host $host;
        }
    }
}
```

Avvia Nginx:

```powershell
C:\\\\nginx\\\\nginx.exe
# Per ricaricare dopo una modifica:
C:\\\\nginx\\\\nginx.exe -s reload
```

Per far partire Nginx automaticamente all'avvio di Windows:

```powershell
# Opzione 1 — startup script (vedi sezione 7)
# Opzione 2 — registrare come servizio con NSSM:
nssm install RistoNginx "C:\\\\nginx\\\\nginx.exe"
nssm set RistoNginx Start SERVICE\\\_AUTO\\\_START
```

### 6.2 — Configurazione Linux

Crea `/etc/nginx/sites-available/risto`:

```nginx
server {
    listen 80;
    server\\\_name risto.local;
    return 301 https://$host$request\\\_uri;
}

server {
    listen 443 ssl http2;
    server\\\_name risto.local;

    ssl\\\_certificate     /etc/nginx/ssl/risto.crt;
    ssl\\\_certificate\\\_key /etc/nginx/ssl/risto.key;

    root /var/www/risto;
    index index.html;

    location / {
        try\\\_files $uri $uri/ /index.html;
    }

    location /rest/ {
        proxy\\\_pass http://127.0.0.1:8000/rest/;
        proxy\\\_set\\\_header Host $host;
        proxy\\\_set\\\_header X-Real-IP $remote\\\_addr;
    }

    location /auth/ {
        proxy\\\_pass http://127.0.0.1:8000/auth/;
        proxy\\\_set\\\_header Host $host;
    }

    location /print-agent/ {
        rewrite ^/print-agent/(.\\\*) /$1 break;
        proxy\\\_pass http://127.0.0.1:8787;
        proxy\\\_set\\\_header Host $host;
    }
}
```

**Genera certificato SSL self-signed e attiva:**

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \\\\
  -keyout /etc/nginx/ssl/risto.key \\\\
  -out /etc/nginx/ssl/risto.crt \\\\
  -subj "/CN=risto.local"
sudo ln -s /etc/nginx/sites-available/risto /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t \\\&\\\& sudo systemctl reload nginx
```

\---

## 7\. Avvio automatico (servizi)

### 7.1 — Windows

Tutti i servizi devono partire automaticamente all'accensione del PC.

**Passo 1 — Docker Desktop**
Imposta l'avvio automatico:

* Apri Docker Desktop → Settings (ingranaggio) → General
* Spunta **"Start Docker Desktop when you log in"**
* (opzionale) Spunta **"Start Minimised"**

**Passo 2 — Supabase** (i container con `restart: unless-stopped` nel
docker-compose.yml ripartono automaticamente con Docker)

**Passo 3 — Print Agent** (già registrato con NSSM, servizio automatico)

**Passo 4 — Nginx** (se registrato con NSSM, servizio automatico)

**Passo 5 — Script di avvio** (per sicurezza)

Crea `C:\\\\risto\\\\start-all.ps1`:

```powershell
# Avvia Supabase (se Docker Desktop è già partito, i container ripartono da soli)
cd C:\\\\risto\\\\supabase
docker compose up -d

# Avvia Print Agent (se servizio NSSM, non serve)
# Avvia Nginx (se servizio NSSM, non serve)
```

Aggiungi a **Esecuzione automatica** di Windows:

```powershell
# Tasto Win + R → shell:startup → incolla collegamento
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\\\\Microsoft\\\\Windows\\\\Start Menu\\\\Programs\\\\Startup\\\\Risto.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\\\\risto\\\\start-all.ps1"
$Shortcut.Save()
```

### 7.2 — Linux (systemd)

```bash
sudo tee /etc/systemd/system/risto.target << 'EOF'
\\\[Unit]
Description=Risto Restaurant System
Wants=docker.service print-agent.service nginx.service
After=network.target docker.service
EOF

docker update --restart=unless-stopped $(docker ps -q)
sudo systemctl enable docker print-agent nginx
```

\---

## 8\. Dump \& Ripristino DB

### 8.1 — Eseguire dump (Windows)

```powershell
# Usa Docker per eseguire pg\\\_dump (senza installare PostgreSQL client)
docker run --rm -v C:\\\\backups\\\\risto:/backup postgres:16 pg\\\_dump `
  -h host.docker.internal -U supabase\\\_user -d postgres `
  --schema=public --no-owner --no-acl --format=custom `
  --file=/backup/risto\\\_$(Get-Date -Format yyyyMMdd\\\_HHmm).dump
```

`host.docker.internal` è l'IP del PC Windows visto dal container Docker.

(Linux: `pg\\\_dump -h localhost -U supabase\\\_user -d postgres --schema=public --no-owner --no-acl --format=custom --file=/backups/risto\\\_$(date +%Y%m%d\\\_%H%M).dump`)

### 8.2 — Eseguire dump da Supabase cloud (migrazione)

Se hai un Supabase cloud e vuoi spostare tutto in locale:

```bash
# Ottieni i parametri di connessione da:
# Supabase Dashboard → Project Settings → Database → Connection string
pg\\\_dump --host=db.xxxxxx.supabase.co --port=5432 --username=postgres \\\\
  --dbname=postgres --schema=public --no-owner --no-acl \\\\
  --format=custom --file=risto\\\_cloud.dump
```

### 8.3 — Ripristino dump

```powershell
# Windows (via Docker)
docker run --rm -i -v C:\\\\backups\\\\risto:/backup postgres:16 pg\\\_restore `
  -h host.docker.internal -U supabase\\\_user -d postgres `
  --no-owner --no-acl --clean --file=/backup/risto\\\_backup.dump

# Linux
# pg\\\_restore -h localhost -U supabase\\\_user -d postgres --no-owner --no-acl --clean risto\\\_backup.dump
```

### 8.4 — Backup automatico Windows (Task Scheduler)

Crea `C:\\\\risto\\\\backup.ps1`:

```powershell
$backupDir = "C:\\\\backups\\\\risto"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force }
$date = Get-Date -Format "yyyyMMdd\\\_HHmm"

docker run --rm -v ${backupDir}:/backup postgres:16 pg\\\_dump `
  -h host.docker.internal -U supabase\\\_user -d postgres `
  --schema=public --no-owner --no-acl --format=custom `
  --file=/backup/risto\\\_$date.dump

# Cancella backup più vecchi di 30 giorni
Get-ChildItem $backupDir -Filter \\\*.dump | Where-Object { $\\\_.LastWriteTime -lt (Get-Date).AddDays(-30) } | Remove-Item
```

Programma con Task Scheduler:

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -File C:\\\\risto\\\\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At 04:00
Register-ScheduledTask -TaskName "Risto Backup DB" -Action $action -Trigger $trigger
```

(Linux: copia lo script in `/etc/cron.daily/risto-backup`)

\---

## 9\. Auto-update da Git

Dopo aver fatto `git push` dal PC di sviluppo, il server non sa che ci sono
nuovi file. Puoi automatizzare il pull + rebuild + reload in due modi.

### 9.1 — Script manuale (PowerShell)

Crea `C:\\\\risto\\\\update.ps1` che puoi lanciare a mano quando vuoi aggiornare:

```powershell
param($Silent = $false)

$repo = "C:\\\\risto"
$dist = "C:\\\\nginx\\\\html\\\\risto"

cd $repo

Write-Host "=== Pull da Git ==="
git pull origin main 2>\\\&1 | Out-Null

Write-Host "=== Install dipendenze ==="
cd "$repo\\\\asporto-app"
npm ci

Write-Host "=== Build frontend ==="
npm run build

Write-Host "=== Deploy su Nginx ==="
# Crea la cartella se non esiste
if (!(Test-Path $dist)) { New-Item -ItemType Directory -Path $dist -Force }
Copy-Item -Path "$repo\\\\asporto-app\\\\dist\\\\\\\*" -Destination $dist -Recurse -Force

Write-Host "=== Ricarica Nginx ==="
\\\& "C:\\\\nginx\\\\nginx.exe" -s reload 2>$null

Write-Host "=== Fatto! ==="
```

Poi basta lanciare:

```powershell
powershell -File C:\\\\risto\\\\update.ps1
```

### 9.2 — Task Scheduler (auto-pull ogni 10 minuti)

Crea `C:\\\\risto\\\\auto-update.ps1` (versione silenziosa che ricostruisce solo
se ci sono nuovi commit):

```powershell
param($Silent = $true)

$repo = "C:\\\\risto"
$dist = "C:\\\\nginx\\\\html\\\\risto"

cd $repo

# Salva HEAD prima del pull
$before = Get-Content "$repo\\\\.git\\\\refs\\\\heads\\\\main" 2>$null

# Pull
git pull origin main 2>\\\&1 | Out-Null

# Salva HEAD dopo il pull
$after = Get-Content "$repo\\\\.git\\\\refs\\\\heads\\\\main" 2>$null

# Se non ci sono cambiamenti, esci
if ($before -eq $after) {
    if (-not $Silent) { Write-Host "Nessun aggiornamento" }
    exit 0
}

# Rebuild
cd "$repo\\\\asporto-app"
npm ci
npm run build

# Deploy
if (!(Test-Path $dist)) { New-Item -ItemType Directory -Path $dist -Force }
Copy-Item -Path "$repo\\\\asporto-app\\\\dist\\\\\\\*" -Destination $dist -Recurse -Force

# Ricarica Nginx
\\\& "C:\\\\nginx\\\\nginx.exe" -s reload 2>$null

if (-not $Silent) { Write-Host "Aggiornato a $(git log -1 --format='%h %s')" }
```

Programma con **Utilità di pianificazione** (Task Scheduler):

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File C:\\\\risto\\\\auto-update.ps1"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 10) `
  -At (Get-Date "00:00") -RepetitionDuration (New-TimeSpan -Days 365)
Register-ScheduledTask -TaskName "Risto Auto Update" -Action $action -Trigger $trigger `
  -RunLevel Highest
```

Ogni 10 minuti il task controlla se ci sono nuovi commit su `origin/main`.
Se non ci sono, lo script finisce in \~2 secondi. Se ci sono, esegue rebuild
e ricarica Nginx.

### 9.3 — Linux (alternative)

```bash
sudo tee /usr/local/bin/risto-update << 'SCRIPT'
#!/bin/bash
cd /opt/risto

echo "=== Pull da Git ==="
git pull origin main

echo "=== Install dipendenze ==="
cd /opt/risto/asporto-app
npm ci

echo "=== Build frontend ==="
npm run build

echo "=== Deploy su Nginx ==="
sudo cp -r dist/\\\* /var/www/risto/

echo "=== Ricarica Nginx ==="
sudo nginx -t \\\&\\\& sudo systemctl reload nginx

echo "=== Fatto! ==="
SCRIPT

sudo chmod +x /usr/local/bin/risto-update
```

Per eseguirlo a mano: `sudo risto-update`

Per auto-pull ogni 5 min con systemd:

```bash
# Servizio
sudo tee /etc/systemd/system/risto-auto-update.service << 'EOF'
\\\[Unit]
Description=Check risto git updates and rebuild
After=network.target
\\\[Service]
Type=oneshot
ExecStart=/usr/local/bin/risto-update
User=root
EOF

# Timer
sudo tee /etc/systemd/system/risto-auto-update.timer << 'EOF'
\\\[Unit]
Description=Check risto updates every 5 minutes
\\\[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
\\\[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now risto-auto-update.timer
```

```powershell
param($Silent = $false)

$repo = "C:\\\\risto"
$dist = "C:\\\\nginx\\\\html\\\\risto"

cd $repo

# Pull
git pull origin main 2>\\\&1 | Out-Null
$pullResult = git log -1 --format="%H"

# Se non ci sono cambiamenti, esci
$lastCommit = Get-Content "$repo\\\\.git\\\\HEAD" 2>$null
$lastDeploy = Get-Content "$repo\\\\.last-deploy" 2>$null
if ($lastCommit -eq $lastDeploy) {
    if (-not $Silent) { Write-Host "Nessun aggiornamento" }
    exit 0
}

# Rebuild
cd "$repo\\\\asporto-app"
npm ci
npm run build

# Deploy
Copy-Item -Path "$repo\\\\asporto-app\\\\dist\\\\\\\*" -Destination $dist -Recurse -Force

# Salva commit deployato
$lastCommit | Set-Content "$repo\\\\.last-deploy"

# Ricarica Nginx
\\\& "C:\\\\nginx\\\\nginx.exe" -s reload 2>$null

if (-not $Silent) { Write-Host "Aggiornato a $lastCommit" }
```

Programma con Task Scheduler (esegue ogni 10 minuti):

```powershell
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-WindowStyle Hidden -File C:\\\\risto\\\\update.ps1 -Silent `$true"
$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 10) `
  -At (Get-Date "00:00") -RepetitionDuration (New-TimeSpan -Days 365)
Register-ScheduledTask -TaskName "Risto Auto Update" -Action $action -Trigger $trigger
```

### 9.4 — Webhook (opzione avanzata)

Se il server è raggiungibile da GitHub (serve IP pubblico o tunnel), puoi
configurare un webhook in GitHub che chiama `C:\\\\risto\\\\update.ps1` a ogni
push. Ma per un server LAN il **Task Scheduler** di Windows (sezione 9.2)
è la soluzione più semplice e robusta.

\---

## 10\. Checklist finale

Prima di andare live:

* \[ ] Docker Desktop o Docker Engine avviato e funzionante
* \[ ] Container Supabase tutti "Up": `docker compose ps` (dentro `supabase/`)
* \[ ] Kong risponde: `curl http://localhost:8000/rest/v1/`
* \[ ] Supabase Studio accessibile: `http://localhost:8083`
* \[ ] Tabelle create nel DB (via Studio o dump)
* \[ ] Ruolo `anon` configurato con permessi
* \[ ] Print Agent funziona: `curl http://localhost:8787/health`
* \[ ] Stampante ha IP statico (DHCP reservation sul router)
* \[ ] `.env.production` ha gli IP corretti (server, stampante)
* \[ ] Frontend buildato: `npm run build` in `asporto-app/`
* \[ ] Frontend servito da Nginx o direttamente
* \[ ] Nginx test passato: `nginx -t` o `C:\\\\nginx\\\\nginx.exe -t`
* \[ ] Tablet può raggiungere il server: `ping 192.168.1.50`
* \[ ] Backup automatico configurato (cron / Task Scheduler)
* \[ ] Firewall: porta 80/443 aperta solo sulla LAN

### Test finale dal tablet

```
Apri browser sul tablet → http://192.168.1.50

1. Verifica che la dashboard carichi
2. Apri un tavolo in POS
3. Aggiungi un prodotto al carrello
4. Premi "STAMPA COMANDA" — deve stampare sulla termica
5. Verifica che il salvataggio su database funzioni
```

\---

## Troubleshooting

### Container Supabase non partono

```powershell
docker compose logs
# Controlla errori di porta già in uso (8000, 5432, 8083)
# Cambia porta in docker-compose.yml se necessario
```

### Kong restituisce 404

```powershell
# Verifica che Kong sia configurato correttamente
curl -v http://localhost:8000/rest/v1/
# Dovrebbe rispondere con JSON (anche se errore di autenticazione)
# Se 404, controlla kong.yml
```

### Stampante non stampa

```powershell
# Test diretto TCP (sostituisci con IP della stampante)
$tcp = New-Object System.Net.Sockets.TcpClient('192.168.1.100', 9100)
$stream = $tcp.GetStream()
$data = \\\[Text.Encoding]::ASCII.GetBytes("Test`n`n`n")
$stream.Write($data, 0, $data.Length)
$stream.Close()

# Test via Print Agent:
curl -X POST http://localhost:8787/print `
  -H "Content-Type: application/json" `
  -d '{"tableName":"TEST","printerIp":"192.168.1.100","items":\\\[{"nome":"Prova","quantity":1}]}'
```

### Frontend non carica (pagina bianca)

```powershell
# Apri console del browser (F12)
# Controlla che le chiamate a /rest/v1/ e /print-agent/ arrivino al server
# Verifica che i proxy Nginx siano configurati
# Controlla che VITE\\\_SUPABASE\\\_URL punti al Kong (porta 8000) o al proxy Nginx
```

### Come trovare l'anon key di Supabase locale

```powershell
# Opzione 1 — dalla console di Supabase Studio
# Vai a http://localhost:8083 → Settings → API → Project API key → anon public

# Opzione 2 — dal container Kong
docker exec supabase-kong-1 cat /etc/kong/kong.yml
# Cerca la riga "key" sotto "anonymous\\\_users"

# Opzione 3 — quella di default per sviluppo locale
# eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn\\\_I0
```

