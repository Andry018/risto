# Telegram Bot - Il Girasole

Bot Telegram con LLM locale (Ollama) per gestione ristorante via linguaggio naturale.

## Funzionalità

- **Add item**: "Aggiungi 2 pizze al tavolo 5"
- **Close table**: "Chiudi il tavolo 3"
- **Print order**: "Stampa cucina 5" / "Stampa sala 5"
- **Availability**: "Non c'è più la pizza margherita" / "Rimetti disponibile il tiramisù"
- **Status**: "Come sta il tavolo 2?"
- **Report**: "Incasso oggi"

## Struttura

```
telegram-bot/
├── package.json
├── tsconfig.json
├── .env                 # Configura con i tuoi valori
├── .env.example
├── src/
│   ├── config.ts        # Config & validazione env
│   ├── tools/
│   │   ├── index.ts     # Definizioni tool (JSON Schema)
│   │   └── implementations.ts  # Implementazioni tool (Supabase/Print)
│   ├── llm.ts           # Client Ollama + function calling
│   └── index.ts         # Entry point Telegraf
├── systemd/
│   └── telegram-bot.service
├── Dockerfile
└── docker-compose.yml
```

## Deploy rapido (Systemd - consigliato)

```bash
# Sul server
cd /opt/risto
git clone <repo>  # o copia cartella telegram-bot
cd telegram-bot

# Configura .env
cp .env.example .env
# EDIT .env con i tuoi valori reali (SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_IDS)

npm ci
npm run build

# Installa systemd
sudo cp systemd/telegram-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now telegram-bot

# Logs
sudo journalctl -u telegram-bot -f
```

## Deploy Docker

```bash
cd /opt/risto/telegram-bot
cp .env.example .env
# EDIT .env

docker compose up -d --build
docker compose logs -f telegram-bot
```

## Configurazione .env richiesta

```env
BOT_TOKEN=8757383543:AAGxvMuFyG3hDKa7W_Mpduf-Cu4SAORnpsI
ADMIN_IDS=123456789,987654321        # I tuoi user_id Telegram (da @userinfobot)
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=phi3.5:3.8b-mini-instruct-q4_K_M
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
PRINT_AGENT_URL=http://localhost:8787
```

## Prerequisiti

1. **Ollama** attivo su porta 11434 con modello `phi3.5:3.8b-mini-instruct-q4_K_M`
2. **Print Agent** su porta 8787 (per /stampa)
3. **Supabase** con service role key
4. **Bot token** da @BotFather
5. **Admin IDs** da @userinfobot

## Test

```bash
# Verifica bot
curl -X POST "https://api.telegram.org/bot<TOKEN>/getMe"

# Scrivi al bot su Telegram:
# "Aggiungi 2 pizze al tavolo 5"
# "Chiudi il tavolo 3"
# "Incasso oggi"
```

## Logs

```bash
# Systemd
sudo journalctl -u telegram-bot -f

# Docker
docker compose logs -f telegram-bot
```

## Architettura

```
Telegram → Telegraf → LLM (Ollama) → Function Calling → Supabase/Print Agent
                    ↑
              Phi-3.5 3.8B Q4_K_M
              (~9.5 tok/s su CPU)
```