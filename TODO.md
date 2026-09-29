# TODO / HANDOFF — Risto (Il Girasole)

_Ultimo aggiornamento: 2026-09-29 (sessione con Claude Code). File unico di passaggio di consegne tra macchine._

---

## 🔴 TASK IN CORSO — Pagamenti carta PAX A35 (Nexi ECR17)

### Stato (29/09 sera)
- Il terminale **risponde**: diagnosi `GET /ecr-agent/diag` → variante LRC corretta = **`stx`**
  (LRC = XOR con base 0x7F di **STX + messaggio + ETX**; la doc Nexi era ambigua).
- Stato terminale `2` (operativo), SW `SYS72031EMV02686ECR01233`.
- **Mai fatto ancora un pagamento reale riuscito.** Il tentativo da €22 (Tavolo 2) è stato rifiutato con NAK
  (LRC sbagliato) → **nessun addebito**.

### Config terminale (menu PAX) e `.env` agent
| Voce | Valore |
|---|---|
| Tipo linea | TCP/IP |
| IP terminale | 192.168.1.201 (fissarlo con prenotazione DHCP sul router!) |
| Porta terminale | **10009** (NON 1009) |
| IP cassa | 192.168.1.250 (CT 100) — il terminale accetta solo da qui |
| Terminal ID | 34572419 |

`/opt/risto/asporto-app/ecr-agent/.env` deve contenere:
```env
PAX_HOST=192.168.1.201
PAX_PORT=10009
PAX_TERMINAL_ID=34572419
PAX_LRC_MODE=stx
PAX_CONNECT_TIMEOUT=5000
PAX_RESPONSE_TIMEOUT=90000
ECR_PORT=8788
ADMIN_SECRET=<stesso valore di admin-server/secrets.env>   # serve per /cancel (storno) e /diag
# PAX_PAY_CODE=P   # solo se lo stato va (ACK) ma il pagamento dà NAK
```

### Prossimi passi (in ordine)
1. [ ] Sul CT: impostare `PAX_LRC_MODE=stx`, `systemctl restart risto-ecr`,
       verificare `grep "Terminale PAX" /opt/risto/logs/ecr.log | tail -1` → `LRC 'stx'`
2. [ ] Pagamento di prova **€0,01** dall'app → `tail -20 /opt/risto/logs/ecr.log`
       - NAK sul pagamento ma ACK sullo stato → `PAX_PAY_CODE=P` + restart
       - Approvato → **verificare nel log che STAN, auth code, importo siano letti alle posizioni giuste**
         (parser in `ecr-agent/index.js` `parseResponse`, layout doc Nexi "Payment with extended result")
3. [ ] Stornare subito la prova da **Cassa fiscale (/cassa) → Pagamenti Carta → Storna** (testa anche lo storno 'S')
4. [ ] Test "risposta persa": comando `G` (recupero ultimo esito) mai provato sul terminale vero
5. [ ] Chiedere a Nexi: valore giusto di **"Disabilita gestione SCA"** (l'agent non gestisce SCA: deve farlo il terminale)
6. [ ] Impostazioni terminale consigliate: Conferma importo ECR = ON (in test), Messaggio di stato = OFF
       per il primo test poi ON, Controllo ID terminale = ON, PAN troncato = ON

### Come funziona (per orientarsi)
- App → `POST /ecr-agent/pay` (nginx → agent :8788) → frame `X` al PAX → ACK → attesa carta (max 90 s) → risposta `E`.
- Risposta persa dopo ACK → agent manda `G` (ultimo esito) e confronta lo STAN con quello precedente
  (`ecr-agent/ecr-state.json`) → esito vero / "nessun addebito" / **"esito sconosciuto"** (schermata gialla, niente riprova alla cieca).
- NAK ripetuto = terminale ha rifiutato = **nessun addebito**.
- Ogni tentativo è registrato in tabella **`pagamenti_carta`** (migration `20260929000000_pagamenti_carta.sql`),
  visibile in **/cassa**. Storno ECR solo sull'**ultima** transazione (limite protocollo Nexi); le altre:
  storno dal terminale + "Segna stornato".
- `/cancel` e `/diag` richiedono header `X-Admin-Secret` (= secret Pannello Sistema, salvato per dispositivo in `/servizi`).
- Log agent: **`/opt/risto/logs/ecr.log`** (NON journalctl). Doc Nexi: https://developer.nexigroup.com/traditionalpos/en-EU/docs/
- Test senza terminale: finto PAX TCP (non nel repo) — vedi commit `45cd5b7`/`5f9a53c` per i casi coperti.

---

## 🟠 Da verificare sul CT (deploy di oggi)

- [ ] `supabase migration up --local --workdir /opt/risto` → crea `pagamenti_carta` (l'autopull lo fa, verificare)
- [ ] **nginx.conf** NON si aggiorna col pull: `diff /etc/nginx/nginx.conf /opt/risto/linux/nginx.conf`,
      poi `cp` + `nginx -t && systemctl reload nginx`. Contiene: timeout 180 s su `/ecr-agent/` (col default 60 s
      nginx tagliava i pagamenti in corso) e blocco `/admin/api/files` solo LAN/Tailscale.
- [ ] `systemctl restart risto-admin` (nuovo endpoint File Manager)
- [ ] Autopull ora usa `npm ci` e non cancella più `package-lock.json`: verificare che il prossimo autopull
      vada a buon fine (`/opt/risto/logs/autopull.log`) e che `npx vite --version` = 5.4.21
- [ ] Test POS: salvare tavolo ed uscire → nessun avviso; aggiungere piatto senza salvare → avviso
- [ ] Test vista camerieri: tavolo con ordine, aggiungi piatto, swipe indietro, riapri, salva →
      stampa solo l'aggiunta e **un solo** ordine IN_ATTESA per il tavolo (prima si duplicava)

---

## 🟡 Telegram bot (funziona, "rincoglionito ma va")
- Modello `qwen2.5:1.5b` (phi3.5 NON supporta tool in Ollama; mini PC 16 GB senza GPU → niente modelli ≥3B).
- 14 tool: tavoli, menu, prezzi, incassi, prenotazioni, magazzino, turni. Ogni scrittura chiede ✅ Conferma.
- Nomi/date/orari li risolve il codice (fuzzy su menu e ingredienti, `tools/dates.ts`), non il modello.
- [ ] Raccogliere frasi capite male → aggiungerle agli esempi in `telegram-bot/src/llm.ts`
- [ ] Misurare tempi di risposta; se lenti ridurre i tool (prompt ~2200 token, `num_ctx` 4096)
- [ ] Testare su DB reale: magazzino carico/scarico, turni, prenotazioni
- Deploy: `cd /opt/risto/telegram-bot && npm ci && npm run build && systemctl restart telegram-bot`
  (`dist/` non è più nel repo: va sempre ricompilato sul CT). Log: `journalctl -u telegram-bot -f`

---

## 🟡 File Manager (in sospeso)
Funziona SOLO da indirizzo interno (`http://192.168.1.250/`), MAI da `gestionale.90-minuti.it`:
il dominio passa sempre dal tunnel Cloudflare (192.168.1.106) anche con Tailscale acceso → 403 (voluto:
scrive file in /opt/risto dove girano script come root).
- [ ] Accesso remoto via Tailscale: sull'host Proxmox `tailscale set --advertise-routes=192.168.1.0/24`,
      approvare la route nella console Tailscale → aprire `http://192.168.1.250/`
- [ ] Se da Tailscale dà 403: `tail /var/log/nginx/access.log | grep files` e aggiungere l'IP in `linux/nginx.conf`
- [ ] Futuro: Cloudflare Access (login email) per usarlo anche dal dominio
- [ ] Testare: naviga, edit, save, upload, delete

---

## ⚠️ Sicurezza — da affrontare
- **Tutte le tabelle Supabase sono scrivibili con la anon key pubblica** (policy `allow_all`), e `/rest/` è
  esposto su internet via Cloudflare. Chiunque abbia la chiave (è nel bundle JS) può leggere/modificare ordini ecc.
  Soluzione consigliata: **Cloudflare Access** davanti a tutto il dominio (login email) — protegge anche
  `/ecr-agent/` (oggi `/pay` è raggiungibile senza auth; `/cancel` e `/diag` richiedono il secret).
- Il vecchio BOT_TOKEN Telegram è nella history git (commit `95448f1`): già revocato, nessuna azione.

---

## 📋 Altro in sospeso
- [ ] Custom WINDKEY-N LITE RT (cassa fiscale): codici comando placeholder, serve manuale tecnico Custom SpA
- [ ] Aggiornare Node.js sul CT a 22 (se non già fatto: `node -v`)
- [ ] Verificare print agent per stampa dal bot (porta 8787)
- [ ] Test completo flusso: ordine → stampa → pagamento → chiusura
- [ ] Test turni: toggle, report, reload

---

## 📝 Note operative

### Infrastruttura
| Host | IP | Ruolo |
|---|---|---|
| CT 100 (Ubuntu 24.04) | 192.168.1.250 | Gestionale: nginx, frontend, Supabase locale, agenti, bot, Ollama |
| CT 106 | 192.168.1.106 | cloudflared → `gestionale.90-minuti.it` |
| PAX A35 (Nexi) | 192.168.1.201 | terminale carte, ECR su 10009 |
| Stampante termica | 192.168.1.200 | print agent :8787 |

Tutto gira su un mini PC 16 GB RAM, **senza GPU**. Repo sul CT: `/opt/risto`.

### Servizi sul CT
| Servizio | Porta | Log |
|---|---|---|
| nginx | 80 | `/var/log/nginx/` |
| risto-admin | 4000 | journalctl |
| risto-print | 8787 | `/opt/risto/logs/print.log` |
| risto-ecr | 8788 | `/opt/risto/logs/ecr.log` |
| risto-webhook (autopull) | 9000 | `/opt/risto/logs/autopull.log` |
| telegram-bot | — | `journalctl -u telegram-bot` |
| ollama | 11434 | `journalctl -u ollama` |
| Supabase | 54321 / 54332 | `supabase status` |

### File locali del CT (NON nel repo, mai committare)
`asporto-app/.env`, `asporto-app/print-agent/.env`, `asporto-app/ecr-agent/.env`,
`asporto-app/ecr-agent/ecr-state.json`, `admin-server/secrets.env`, `telegram-bot/.env`.
Prima di un `git pull` che rimuove file dal tracking: backup dei `.env` (il pull li cancella dal disco).

### Variabili del bot (`telegram-bot/.env`)
```env
BOT_TOKEN=<da @BotFather — MAI committare>
ADMIN_IDS=576950037
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:1.5b
SUPABASE_URL=http://localhost:54321      # localhost, NON il dominio
SUPABASE_SERVICE_KEY=<da: supabase status -o env | grep SERVICE_ROLE_KEY>
PRINT_AGENT_URL=http://localhost:8787
```

### Regole del codice (vedi anche HANDOFF.md)
- Date: sempre `toLocalISODate()`, mai `toISOString()` per le date di calendario.
- Mai definire componenti React dentro altre funzioni (remount + perdita focus).
- Ordini/tavoli dal frontend: `syncManager.pushOrder()` / `pushTableUpdate()`, non Supabase diretto.
- Nuove tabelle: RLS + policy `allow_all` + GRANT come le altre migration.
- `useToast()`: nelle dipendenze degli hook usare solo `addToast` (l'oggetto cambia a ogni toast → loop).

### Repo / nuova macchina
```bash
git clone https://github.com/Andry018/risto.git && cd risto
cd asporto-app && npm ci && npm run build
cd ../telegram-bot && npm ci && npm run build
```

## 🔗 Link
- Doc Nexi Traditional POS: https://developer.nexigroup.com/traditionalpos/en-EU/docs/
- BotFather: @BotFather — UserInfoBot: @userinfobot
- Ollama models: https://ollama.com/library
