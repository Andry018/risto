# WA Agent — WhatsApp nel gestionale

```
Tablet (/whatsapp) ──HTTPS──▶ nginx /wa-agent/ ──▶ wa-agent :8789 ──apikey──▶ Evolution API :8085 (Docker) ──▶ WhatsApp
                                  ▲                          │
                                  └──────── SSE /events ◀────┘◀── webhook (nuovi messaggi, QR, connessione)
```

- **Evolution API** tiene la sessione WhatsApp (come un "dispositivo collegato", stile WhatsApp Web).
- **wa-agent** nasconde l'API key di Evolution e chiede un token (`WA_ACCESS_TOKEN`) a ogni tablet:
  il gestionale è esposto su internet e le chat contengono dati dei clienti.

## Installazione sul CT (una volta)

```bash
cd /opt/risto/asporto-app/wa-agent

# 1. Configurazione (setup.sh lo fa da solo con chiavi casuali; a mano:)
cp .env.example .env && chmod 600 .env
nano .env        # sostituisci tutti i "cambiami-..." (openssl rand -hex 24)

# 2. Evolution API + Postgres dedicato
docker compose up -d
docker logs -f risto-evolution     # attendi "HTTP - ON: 8080"

# 3. Servizio agent
cp /opt/risto/linux/services/risto-wa.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now risto-wa
curl -s localhost:8789/health

# 4. nginx (NON si aggiorna col pull)
cp /opt/risto/linux/nginx.conf /etc/nginx/nginx.conf && nginx -t && systemctl reload nginx
```

## Primo collegamento

1. Dal tablet: icona **WhatsApp** in dashboard → inserisci il token (`WA_ACCESS_TOKEN`).
2. **Genera QR** → sul telefono del locale: *Impostazioni → Dispositivi collegati → Collega un dispositivo*.
3. Il telefono deve restare acceso e con internet (come per WhatsApp Web).

## Problemi

| Sintomo | Controllo |
|---|---|
| "WhatsApp non raggiungibile" | `systemctl status risto-wa`, `tail -50 /opt/risto/logs/wa.log`, `docker ps` |
| Messaggi nuovi non arrivano in tempo reale | Il container deve raggiungere l'host: `docker exec risto-evolution wget -qO- http://host.docker.internal:8789/health`. Se il firewall blocca, aprire la 8789 verso la rete docker (172.16.0.0/12) |
| QR non compare / scade | Premi "Nuovo QR"; se persiste aggiorna l'immagine: `docker compose pull && docker compose up -d` |
| Token non valido | Il tablet torna alla schermata token: reinserirlo |

Note:
- Rischio ban: usare WhatsApp per rispondere ai clienti va bene; **non** fare invii massivi/pubblicitari.
- L'immagine Evolution è `:latest`: quando funziona, fissare il tag in `docker-compose.yml`
  (WhatsApp cambia protocollo spesso, gli aggiornamenti servono ma vanno fatti consapevolmente).
