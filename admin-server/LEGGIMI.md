# Pannello Servizi (backend)

Piccolo server HTTP (zero dipendenze, solo Node built-in) che espone API JSON
per controllare i servizi sul PC del locale (nginx, webhook, print agent,
aggiornamento da Git). Il frontend **non è più qui**: è la pagina "Pannello
Servizi" dentro la webapp React, raggiungibile da Impostazioni → Sistema, o
direttamente su `/servizi`.

## File

```
C:\risto\
├── admin-server\
│   ├── server.js           ← Server HTTP (API JSON, nessuna UI)
│   ├── secrets.bat.example ← Copia in secrets.bat e imposta ADMIN_SECRET
│   ├── secrets.bat         ← MAI committato (in .gitignore), locale al PC
│   └── avvio_admin.bat     ← Avvio manuale (doppio click, per test)
├── avvia_pannello.bat      ← Avviato automaticamente da start.bat (step 6)
└── nginx\conf\nginx.conf   ← location /admin/ già configurata
```

## Setup (una volta sola, sul PC del locale)

1. `cd C:\risto\admin-server`
2. Copia `secrets.bat.example` in `secrets.bat`
3. Modifica `secrets.bat` e imposta una stringa lunga e casuale per `ADMIN_SECRET`
4. Nella webapp: Impostazioni → Sistema → Pannello Servizi → incolla la stessa
   stringa quando richiesta (viene salvata in locale sul dispositivo/browser
   usato per amministrare)

Senza `secrets.bat` il server **si rifiuta di avviarsi** (fail-safe, niente
default in produzione).

## Avvio manuale (test)

```cmd
cd /d C:\risto\admin-server
call secrets.bat
node server.js
```

## Autenticazione

Ogni richiesta alle API deve avere l'header `X-Admin-Secret: <ADMIN_SECRET>`.
Nessuna password utente/utente separata da ricordare — un solo secret condiviso
tra `admin-server` e la pagina "Pannello Servizi", stesso pattern del
`PUBLISH_SECRET` del Menu Pubblico.

## Endpoint API

| Metodo | Path                | Cosa fa                     |
|--------|---------------------|------------------------------|
| GET    | /api/status         | Stato nginx + webhook + print agent + pannello |
| GET    | /api/log            | Ultime 200 righe log_git.txt |
| POST   | /api/restart-nginx  | Riavvia Nginx                |
| POST   | /api/autopull       | Esegue autopull.bat          |
| POST   | /api/restart-print  | Riavvia Print Agent          |
| POST   | /api/restart-webhook| Riavvia Webhook               |
| POST   | /api/restart-admin  | Riavvia questo stesso server |
| POST   | /api/restart-all    | Riavvia nginx + webhook + print agent |

**Rimosso** l'endpoint `/api/exec` (eseguiva comandi shell arbitrari):
troppo rischioso da esporre, anche dietro auth — se serve eseguire qualcosa
di specifico, va aggiunto un endpoint dedicato con validazione, non un
comando libero.

## Nginx

Blocco `location /admin/` già presente in `nginx.conf` (con redirect
automatico da `/admin` senza slash finale). Se modifichi `nginx.conf`:
```cmd
cd /d C:\risto\nginx
nginx -s reload
```
