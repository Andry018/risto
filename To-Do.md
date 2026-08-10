# To-Do — Risto (Il Girasole)

_Ultimo aggiornamento: 2026-08-10_

## 🔴 Da fare subito (bloccato su azioni tue)

- [x] **Push delle ultime modifiche** — WiFi QR su `/qr-menu`, sezione "Menu Online" in Impostazioni. Pushate su `origin/main` (commit `528ffc2`, 2026-08-10).
- [ ] **Menu Pubblico — completare il deploy**:
  - [ ] Eseguire `menu-pubblico/schema.sql` nel SQL Editor del progetto Supabase Cloud (`ihkdpdawyksohtggspbw`)
  - [ ] Deploy della cartella `menu-pubblico/` su Vercel
  - [ ] Variabili d'ambiente su Vercel: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (dalla dashboard Supabase, **non** l'anon key), `PUBLISH_SECRET` (a scelta, lunga e casuale)
  - [ ] Collegare il dominio in Vercel → Settings → Domains
  - [ ] Nell'app locale, Impostazioni → Menu Online: inserire URL + `PUBLISH_SECRET`, poi premere "Pubblica Menu Online"
- [ ] **Magazzino — primo utilizzo reale**: aggiungere i primi articoli e verificare che carico/scarico funzionino nel servizio vero (schema già confermato funzionante via query diretta).
- [x] **Eseguire la nuova migrazione** `supabase/migrations/20260809000000_magazzino_barcode.sql` (aggiunge la colonna `codice_a_barre`) — applicata dall'utente.

## 🟡 In sospeso (serve una decisione)

- [ ] **Food cost**: richiede un sistema di ricette (piatto → ingredienti di magazzino con quantità consumate). Non è un'estensione veloce di Magazzino, è una feature a sé — da avviare quando si decide di investirci.
- [ ] **WhatsApp per l'invio fatture**: serve un account WhatsApp Business API (Meta Cloud o Twilio) prima di poter partire.

## 🟢 Idee future (non prioritarie)

- [ ] **Dashboard a sezioni per il telefono**: fatta la versione base (hub con Sala/Prenotazioni/Turno/Cucina/Magazzino/Report/Impostazioni in base al ruolo) — eventuali rifiniture visive quando serve.
- [ ] **OCR lavagna cucina**: fotografare la lavagna del menu del giorno e aggiornare automaticamente la disponibilità in `/kitchen`. Servirebbe un vision model (non OCR classico, va anche capito cosa è barrato) — consigliato **con conferma umana**, non automazione cieca. Da riprendere solo se il toggle disponibilità manuale risulta davvero troppo lento in pratica.

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
- **Permessi granulari dentro `/kitchen`**: il ruolo kitchen ora vede solo il toggle disponibilità (piatti, aggiunte, rimozioni, varianti) — niente più aggiunta/modifica/eliminazione né gestione categorie. Verificato in browser per entrambi i ruoli (admin invariato, kitchen ristretto).
- **Audit testo piccolo**: tutte le occorrenze `text-[8px]`/`text-[9px]` rimaste (escluse le etichette HACCP e i QR da stampa, vincolate a dimensioni fisiche) alzate di uno step (8→9, 9→10px). Verificato senza overflow su POS e altre viste.
- **Split di `AdminView.tsx`**: da 1025 a ~410 righe. Estratti `components/admin/{MenuTab,IngredientsTab,RemovalsTab,VariantsTab,IngredientFormModal}.tsx`; logica/stato di alto livello rimasti in AdminView, VariantsTab gestisce il proprio stato in autonomia. Type-check, 65 test e verifica manuale di tutti i tab (menu/aggiunte/rimozioni/varianti/haccp) per admin e kitchen: tutto invariato.

## 📝 Note operative

- **PIN staff**: disattivato di proposito, sistema pensato per LAN locale — riattivabile se un domani serve.
- **Corrispettivi telematici / RT**: gestiti esternamente (chiusura cassa a parte, fatture PDF mandate al commercialista) — non è un problema di questo software, ma va tenuto a mente se mai si vuole vendere il sistema a terzi.
- **Tailscale**: installato sia su questo PC che sul PC del locale (`100.87.32.16`), funzionante per la verifica diretta del database quando serve.
