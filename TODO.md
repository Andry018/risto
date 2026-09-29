# TODO - Prossimi passi per macchina differente

## 🎯 Completato
- [x] Stampa delta (AGGIORNA) vs ristampa completa (STAMPA) - Waiter & POS
- [x] Turni persistenti con async sync + rollback + reload da Reports
- [x] Changelog modal (v2.1.1) con info icon in StaffDashboard & WaiterMobileView
- [x] UX Tablet: inline covers picker, swipe back, 44px touch targets
- [x] Code-split routes (main 1MB → 500KB + lazy chunks)
- [x] Telegram Bot deployato (systemd) con qwen2.5:1.5b: tavoli, menu, prenotazioni, incassi, magazzino, turni — azioni con conferma
- [x] Ollama CPU optimization (fix-ollama-cpu.sh → 9.5 tok/s)
- [x] File Manager in SettingsView via admin-server (`/admin/api/files`, solo LAN/Tailscale)

## 📋 Da fare (prossima sessione)

### File Manager
- [ ] Sul CT: copiare `linux/nginx.conf` in `/etc/nginx/nginx.conf` + `nginx -t && systemctl reload nginx`, riavviare `risto-admin`
- [ ] Testare da LAN/Tailscale: naviga, edit, save, upload, delete (da internet deve dare 403)
- [ ] Aggiungere syntax highlighting per editor (CodeMirror/Monaco se serve)

### Telegram Bot
- [ ] Migliorare comprensione (il modello 1.5B sbaglia spesso): raccogliere frasi fallite → esempi nel prompt
- [ ] Misurare tempi di risposta su CPU; se lenti, ridurre i tool
- [ ] Testare su DB reale: magazzino (carico/scarico), turni, prenotazioni

### Print Agent
- [ ] Verificare print agent su porta 8787 per bot (stampa cucina/sala)

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
- **Ollama**: `curl -fsSL https://ollama.com/install.sh | sh && ollama pull qwen2.5:1.5b`

### Variabili d'ambiente critiche
```env
# telegram-bot/.env
BOT_TOKEN=<da @BotFather — MAI committare>
ADMIN_IDS=576950037
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
SUPABASE_URL=http://localhost:54321
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