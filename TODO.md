# TODO - Prossimi passi per macchina differente

## 🎯 Completato
- [x] Stampa delta (AGGIORNA) vs ristampa completa (STAMPA) - Waiter & POS
- [x] Turni persistenti con async sync + rollback + reload da Reports
- [x] Changelog modal (v2.1.1) con info icon in StaffDashboard & WaiterMobileView
- [x] UX Tablet: inline covers picker, swipe back, 44px touch targets
- [x] Code-split routes (main 1MB → 500KB + lazy chunks)
- [x] Telegram Bot scaffold completo con LLM locale (Ollama + Phi-3.5 3.8B Q4)
- [x] Ollama CPU optimization (fix-ollama-cpu.sh → 9.5 tok/s)
- [x] File Manager in SettingsView + Edge Function Supabase

## 📋 Da fare (prossima sessione)

### File Manager
- [ ] Deploy Edge Function `file-manager` su Supabase Dashboard
- [ ] Configurare `VITE_FILE_MANAGER_URL` in `.env` (es. `https://xxx.supabase.co/functions/v1/file-manager`)
- [ ] Testare upload/download/edit file da Settings → File Manager
- [ ] Aggiungere syntax highlighting per editor (CodeMirror/Monaco se serve)

### Telegram Bot
- [ ] Configurare `.env` su server con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_IDS`
- [ ] Deploy bot (systemd o docker-compose) su server
- [ ] Testare comandi: "Aggiungi 2 pizze al tavolo 5", "Chiudi il 3", "Incasso oggi"

### Ollama / LLM
- [ ] Verificare modello `phi3.5:3.8b-mini-instruct-q4_K_M` su server
- [ ] Testare function calling da Telegram
- [ ] Eventualmente aggiungere modelli alternativi (qwen2.5:3b)

### Print Agent
- [ ] Verificare print agent su porta 8787 per bot (stampa cucina/sala)

### Supabase Edge Functions
- [ ] Deploy `file-manager` function
- [ ] Configurare CORS headers per accesso da app

### Testing & Polish
- [ ] Test completo flusso: ordine → stampa → pagamento → chiusura
- [ ] Test turni: toggle, report, reload
- [ ] Test file manager: naviga, edit, save, upload, delete

## 📝 Note per macchina differente

### Repo
```bash
git clone https://github.com/Andry018/risto.git
cd risto
```

### Dipendenze principali
- **asporto-app**: `npm ci && npm run build`
- **telegram-bot**: `cd telegram-bot && npm ci && npm run build`
- **Ollama**: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull phi3.5:3.8b-mini-instruct-q4_K_M`

### Variabili d'ambiente critiche
```env
# asporto-app/.env
VITE_FILE_MANAGER_URL=https://xxx.supabase.co/functions/v1/file-manager

# telegram-bot/.env
BOT_TOKEN=8757383543:AAGxvMuFyG3hDKa7W_Mpduf-Cu4SAORnpsI
ADMIN_IDS=123456789,987654321
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=phi3.5:3.8b-mini-instruct-q4_K_M
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
PRINT_AGENT_URL=http://localhost:8787
```

### Comandi utili server
```bash
# Ollama fix CPU
./fix-ollama-cpu.sh

# Logs bot
journalctl -u telegram-bot -f

# Logs Ollama
journalctl -u ollama -f

# Build app
cd asporto-app && npm run build

# Build bot
cd telegram-bot && npm run build
```

## 🔗 Link utili
- Supabase Dashboard: https://supabase.com/dashboard
- BotFather: @BotFather
- UserInfoBot: @userinfobot
- Ollama models: https://ollama.com/library