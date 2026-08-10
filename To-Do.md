# To-Do — Risto (Il Girasole)

_Ultimo aggiornamento: 2026-08-09_

## 🔴 Da fare subito (bloccato su azioni tue)

- [x] **Push delle ultime modifiche** — WiFi QR su `/qr-menu`, sezione "Menu Online" in Impostazioni. Pushate su `origin/main` (commit `528ffc2`, 2026-08-10).
- [ ] **Menu Pubblico — completare il deploy**:
  - [ ] Eseguire `menu-pubblico/schema.sql` nel SQL Editor del progetto Supabase Cloud (`ihkdpdawyksohtggspbw`)
  - [ ] Deploy della cartella `menu-pubblico/` su Vercel
  - [ ] Variabili d'ambiente su Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (dalla dashboard Supabase, **non** l'anon key), `PUBLISH_SECRET` (a scelta, lunga e casuale)
  - [ ] Collegare il dominio in Vercel → Settings → Domains
  - [ ] Nell'app locale, Impostazioni → Menu Online: inserire URL + `PUBLISH_SECRET`, poi premere "Pubblica Menu Online"
- [ ] **Magazzino — primo utilizzo reale**: aggiungere i primi articoli e verificare che carico/scarico funzionino nel servizio vero (schema già confermato funzionante via query diretta).
- [ ] **Eseguire la nuova migrazione** `supabase/migrations/20260809000000_magazzino_barcode.sql` (aggiunge la colonna `codice_a_barre`) — stesso procedimento delle altre: SQL Editor del locale, o `npx supabase migration up`.

## 🟡 In sospeso (serve una decisione)

- [ ] **Food cost**: richiede un sistema di ricette (piatto → ingredienti di magazzino con quantità consumate). Non è un'estensione veloce di Magazzino, è una feature a sé — da avviare quando si decide di investirci.
- [ ] **Split di `AdminView.tsx`** (1025 righe): rimandato per rischio — è la pagina di gestione menu usata anche da telefono durante il servizio. Da fare con calma, non a ridosso di un servizio, con possibilità di testare bene prima di mergiare.
- [ ] **WhatsApp per l'invio fatture**: serve un account WhatsApp Business API (Meta Cloud o Twilio) prima di poter partire.

## 🟢 Idee future (non prioritarie)

- [ ] **Dashboard a sezioni per il telefono**: fatta la versione base (hub con Sala/Prenotazioni/Turno/Cucina/Magazzino/Report/Impostazioni in base al ruolo) — eventuali rifiniture visive quando serve.
- [ ] **OCR lavagna cucina**: fotografare la lavagna del menu del giorno e aggiornare automaticamente la disponibilità in `/kitchen`. Servirebbe un vision model (non OCR classico, va anche capito cosa è barrato) — consigliato **con conferma umana**, non automazione cieca. Da riprendere solo se il toggle disponibilità manuale risulta davvero troppo lento in pratica.
- [ ] **Audit completo testo piccolo**: sistemato solo il caso peggiore (sidebar categorie POS, era a 6px). Altri `text-[8-9px]` sparsi in ~12 file, per lo più etichette decorative — bassa priorità.
- [ ] **Permessi più granulari dentro `/kitchen`**: oggi chi accede a Cucina (admin/kitchen) può fare tutto (aggiungere, modificare, eliminare piatti). Se un domani serve che il ruolo "kitchen" possa solo togliere disponibilità senza editare/eliminare, va costruito un livello di permessi più fine dentro AdminView stesso.

## ✅ Completato in questa fase di lavoro

- Bug critici corretti: split conto, portata persa su conto sospeso, coda offline (idempotency key + sblocco automatico), wake lock, encoding UTF-8, race condition WaiterMobileView, calcolo prezzi ingredienti aggiunti/rimossi, calcolo date UTC vs locale
- Layout POSView adattato per iPad A16 2025
- Sistema multi-operatore con PIN persistito per dispositivo + permessi granulari per ruolo (admin/waiter/kitchen) sulle rotte sensibili
- Turni (pranzo/sera, marcatura manuale da dipendente o admin)
- Sconto POS con tastierino numerico riutilizzabile
- Generazione fatture PDF corretta (bug altezza tabella, formato importi IT, numero documento)
- Dashboard tablet e telefono ristrutturate a sezioni macro (Sala, Cucina, Magazzino, Personale)
- **Magazzino**: tabelle DB, carico/scarico atomico via RPC, avvisi sotto-scorta, costo unitario, collegato a dashboard/hub/rotte
- **Scanner codici a barre nel Magazzino**: scansione da fotocamera (`html5-qrcode`), riconosce articoli già censiti (salta al carico) o cerca il prodotto su Open Food Facts per pre-compilare nome/categoria/unità — richiede la migrazione `20260809000000_magazzino_barcode.sql` (vedi sopra)
- WiFi QR code accanto al QR del menu (`/qr-menu`)
- Base per Menu Pubblico online (sito statico + endpoint di pubblicazione sicuro) — da completare il deploy (vedi sopra)

## 📝 Note operative

- **PIN staff**: disattivato di proposito, sistema pensato per LAN locale — riattivabile se un domani serve.
- **Corrispettivi telematici / RT**: gestiti esternamente (chiusura cassa a parte, fatture PDF mandate al commercialista) — non è un problema di questo software, ma va tenuto a mente se mai si vuole vendere il sistema a terzi.
- **Tailscale**: installato sia su questo PC che sul PC del locale (`100.87.32.16`), funzionante per la verifica diretta del database quando serve.
