# Pannello Amministrazione

## File creati

```
C:\risto\
├── admin-server\
│   ├── server.js          ← Server HTTP (zero dipendenze, solo Node built-in)
│   ├── avvio_admin.bat    ← Avvio manuale (doppio click)
│   └── public\
│       └── index.html     ← Frontend Tailwind
├── avvia_pannello.bat     ← Avviato automaticamente da start.bat (step 6)
└── nginx\conf\nginx.conf  ← Già aggiornato con location /admin/
```

## Deploy sul server (C:\risto)

Dopo `git pull`, il pannello è già integrato in `start.bat` (step 6 → `avvia_pannello.bat`).

## Avvio manuale (test)

```cmd
cd /d C:\risto\admin-server
node server.js
```

Apri: http://localhost:4000 (o http://192.168.1.250/admin via nginx)

**Credenziali default:** `admin` / `ristorante123`
(Cambia con `set ADMIN_PASS=...` prima di avviare, o modifica server.js)

## Cambiare password

Modifica la riga 12 in `server.js`:
```js
const ADMIN_PASS = process.env.ADMIN_PASS || 'nuova_password';
```
Poi riavvia.

## Endpoint API

| Metodo | Path                | Cosa fa                     |
|--------|---------------------|-----------------------------|
| GET    | /api/status         | Stato nginx + print agent   |
| GET    | /api/log            | Ultime 200 righe log_git.txt|
| POST   | /api/restart-nginx  | Riavvia Nginx               |
| POST   | /api/autopull       | Esegue autopull.bat         |
| POST   | /api/restart-print  | Riavvia Print Agent         |
| POST   | /api/exec           | Comando CMD personalizzato  |

## Nginx

Aggiunto blocco `location /admin/` già in nginx.conf. Per attivarlo:
```cmd
cd /d C:\risto\nginx
nginx -s reload
```

Ora il pannello è raggiungibile su http://192.168.1.250/admin
