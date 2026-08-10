# HANDOFF — Risto (Il Girasole)

_Sessione del 2026-08-06 → 2026-08-09. Per la lista prioritizzata dei prossimi passi vedi [To-Do.md](To-Do.md) — qui sotto solo un estratto essenziale._

## 1. Stato attuale

Sessione lunga di audit + fix + nuove feature su un gestionale ristorante (React/Vite/TS + Supabase, deploy locale su LAN al ristorante).

**Bug critici corretti** (tutti verificati con test/type-check, molti anche in browser):
- Split conto POS calcolava le quote sul totale lordo invece che scontato
- "Metti in sospeso" perdeva il campo `portata` (sequenza uscite in cucina)
- Coda di sync offline (`OfflineSync.ts`) segnava come riuscito un `TABLE_UPDATE` fallito → dati persi silenziosamente; aggiunta anche protezione anti-blocco su elementi "poison" (retry infiniti) e idempotency key sugli INSERT (upsert su id generato client-side, evita duplicati su retry dopo timeout)
- Wake lock ("always on") non si riattivava senza reload dopo il toggle in Impostazioni
- Encoding UTF-8 rotto (mojibake, es. `Ã¨`→`è`, `â‚¬`→`€`) in POSView, AdminView, WaiterMobileView, CategoryFilterBar, ProductFormModal — in un caso (ProductFormModal) rompeva anche un confronto stringa reale
- Race condition su flag di soppressione notifiche realtime in WaiterMobileView (un solo flag condiviso tra tabella `ordini` e `tavoli` → notifiche perse/sbagliate); risolto con due flag separati
- Stato carrello inconsistente cambiando tavolo velocemente in WaiterMobileView (mancava un controllo "il tavolo selezionato è ancora questo?")
- Calcolo prezzo ingredienti aggiunti in `orderCarrelloMap.ts`: ripartiva lo scarto proporzionalmente al prezzo di catalogo (amplificava l'errore sull'ingrediente più caro) invece che in parti uguali; con un solo ingrediente sovrascriveva comunque il prezzo noto
- Date calcolate in UTC invece che fuso locale (`new Date().toISOString().split('T')[0]`) in report, prenotazioni, dashboard — sostituito ovunque con `toLocalISODate()` (nuovo helper)
- PDF fatture: altezza tabella mai calcolata correttamente (bug nell'uso di `jspdf-autotable`), numero documento non numerico stampava "NaN", importi in formato italiano (`1.234,56`) troncati nel parsing

**Feature nuove**:
- Layout POSView adattato per iPad A16 2025 (portrait/landscape)
- Sistema multi-operatore: PIN persistito per dispositivo (`staffAuth.ts`, prima uno stub sempre-vero), gestione operatori da Impostazioni, permessi granulari per ruolo (admin/waiter/kitchen) su `/kitchen`, `/reports`, `/settings`, `/magazzino`
- Turni (pranzo/sera, marcatura manuale, sia da dipendente che da admin)
- Sconto POS + tastierino numerico riutilizzabile (`NumericKeypad.tsx`)
- Dashboard ristrutturate: tablet a sezioni macro (Sala/Cucina/Magazzino/Personale), telefono con hub iniziale invece di partire dritto sui tavoli
- **Magazzino**: tabelle DB (`magazzino_articoli`, `magazzino_movimenti`), carico/scarico atomico via funzione RPC Postgres, avvisi sotto-scorta, costo unitario, storico movimenti
- **Scanner codici a barre** nel Magazzino: fotocamera (`html5-qrcode`) + lookup su Open Food Facts (gratis) per pre-compilare i nuovi articoli, riconosce articoli già censiti e salta al carico
- WiFi QR code accanto al QR menu (`/qr-menu`) — soluzione "zero sforzo" al problema del menu pubblico raggiungibile solo da chi è sul WiFi del locale
- **Menu Pubblico online** (`menu-pubblico/`): sito statico + endpoint serverless di pubblicazione, progetto Supabase Cloud separato da quello del locale — **codice completo ma non ancora deployato** (vedi sezione 3)
- Fix ambiente test: `vite.config.ts` usava `environment: 'node'` invece di `jsdom` → mancava `localStorage`, causava 15 dei 17 test falliti dall'inizio sessione. Ora 65/65 passano.

## 2. Architettura e Decisioni

- **Modello di sicurezza "LAN locale"**: RLS permissiva ovunque (`USING (true)`), nessuna vera autenticazione Supabase. `staffAuth.ts` è un sistema custom basato su `localStorage`, pensato per **attribuzione** (chi fa cosa) non per **controllo accessi rigido** — deciso esplicitamente con l'utente. Il PIN operatore protegge solo `/kitchen`, `/reports`, `/settings`, `/magazzino`; `/pos`, `/map`, `/reservations` restano liberi di proposito.
- **`requireManagerPin()`** (in `staffAuth.ts`) è un sistema separato dal PIN operatore — usato per singole azioni sensibili (elimina, svuota DB, ecc.), confronta con un PIN "responsabile" unico salvato in `localStorage`.
- **Date**: usare sempre `toLocalISODate()` da `lib/dateUtils.ts` per "oggi" — mai `new Date().toISOString().split('T')[0]` (bug UTC scoperto e corretto in ~10 punti diversi).
- **Offline sync** (`OfflineSync.ts`): coda in `localStorage`, drain serializzato (`drainTail` promise chain), upsert (non insert) con id generato client-side per gli INSERT nuovi → retry sicuri. Elementi che falliscono >5 volte vengono spostati in fondo alla coda invece di bloccarla (a meno che siano l'unico elemento, per evitare loop stretto).
- **Migrazioni DB**: file SQL timestampati in `supabase/migrations/`, **mai applicati direttamente da questo ambiente** (nessun accesso Docker/Supabase CLI diretto). Vanno sempre eseguiti manualmente dall'utente (SQL Editor o `supabase migration up`), poi verificati via query REST dirette quando possibile (Tailscale, vedi sotto).
- **Verifica DB da remoto**: Tailscale installato su questo PC e sul PC del locale (IP `100.87.32.16`), permette query dirette via REST API (`curl` con anon key) per confermare che le migrazioni siano state applicate, senza bisogno di accesso interattivo al PC del locale.
- **Menu Pubblico**: deliberatamente un progetto Supabase Cloud **separato** da quello del locale (nessun dato sensibile condiviso). Pubblicazione "a snapshot" (pulsante manuale), non sync in tempo reale — scelta esplicita per semplicità/robustezza. La `service_role` key vive solo come env var server-side in una funzione serverless Vercel (`menu-pubblico/api/publish-menu.js`), mai nel bundle client. L'anon key invece è imbustata direttamente nell'HTML statico: è previsto che sia pubblica (la sicurezza è nelle policy RLS, non nella segretezza della chiave).
- **Componenti riutilizzabili chiave**: `NumericKeypad.tsx` (tastierino touch, usato in POS/sconto/Magazzino), `StaffPinGuard.tsx` (ora accetta sia `children` che `<Outlet/>`, più `requiredRoles` per il controllo permessi).
- **WaiterMobileView.tsx** resta il componente più grande e delicato (vista cameriere da telefono, usata in produzione durante il servizio) — modifiche lì vanno sempre verificate con cura. `AdminView.tsx` è stato invece splittato in `components/admin/*Tab.tsx` per ridurne la dimensione (vedi sezione 3).

## 3. Problemi Aperti

- **Menu Pubblico non ancora deployato**: codice pronto (`menu-pubblico/`) ma servono azioni manuali dell'utente — eseguire `schema.sql` sul progetto Supabase Cloud, deploy su Vercel, configurare env var (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLISH_SECRET`), collegare dominio, poi inserire URL+secret nell'app locale. Non testato end-to-end con dati reali (solo verificato che l'errore 404 atteso — tabella non ancora creata — si gestisce correttamente).
- **Food cost**: non costruito. Richiede un sistema di ricette (piatto → ingredienti di magazzino con quantità) che non esiste — decisione di scope da prendere prima di iniziare, non è un'estensione veloce.
- **WhatsApp fatture** e **OCR lavagna cucina**: solo discussi concettualmente, nessun codice. Entrambi richiedono decisioni esterne (account WhatsApp Business, quale vision model) prima di poter iniziare.
- **Strade valutate e scartate**: ripartizione proporzionale del prezzo ingredienti (sostituita con ripartizione equa — vedi bug corretti); silent auto-toggle per l'ipotetico OCR lavagna (scartato a favore di conferma umana esplicita, troppo rischioso lasciare automatico); dashboard telefono con card dettagliate stile tablet (l'utente ha chiesto box più semplici via screenshot, rifatta più minimale).

### Risolti in questa sessione (dopo la stesura iniziale di questo file)
- **Ruolo "kitchen" troppo permissivo**: ora dentro `AdminView` il ruolo kitchen vede solo il toggle disponibilità (piatti/aggiunte/rimozioni/varianti), niente aggiunta/modifica/eliminazione né gestione categorie. Flag `canEditMenu` (da `getCurrentUser().role`) passato a tutti i sotto-componenti tab.
- **Audit testo piccolo**: tutte le occorrenze `text-[8-9px]` rimanenti alzate di uno step (8→9, 9→10px), escluse le etichette HACCP stampabili e i QR da stampa (vincolate a dimensioni fisiche di stampa, rischio overflow).
- **Split di `AdminView.tsx`**: fatto, da 1025 a ~410 righe. Estratti `components/admin/{MenuTab,IngredientsTab,RemovalsTab,VariantsTab,IngredientFormModal}.tsx` — estrazione meccanica di JSX, stato/logica di alto livello rimasti in `AdminView` (eccetto `VariantsTab` che è completamente autonomo). Verificato con type-check, 65 test, e verifica manuale in browser di tutti i 5 tab per ruolo admin e kitchen.

## 4. TODO List

Vedi [To-Do.md](To-Do.md) per la lista completa e prioritizzata. Le prime 3 cose bloccanti in ordine:

1. ~~Push delle modifiche non ancora committate~~ — fatto (commit `528ffc2`, 2026-08-10)
2. ~~Eseguire le 2 migrazioni pendenti~~ — fatto, entrambe applicate dall'utente
3. **Completare il deploy del Menu Pubblico** (Supabase Cloud schema + Vercel + dominio)

## 5. File Modificati

### Nuovi file (non tracciati da git)
- `To-Do.md`, `HANDOFF.md` (root)
- `asporto-app/src/components/BarcodeScanner.tsx`
- `asporto-app/src/components/MagazzinoView.tsx`
- `asporto-app/src/components/NumericKeypad.tsx`
- `asporto-app/src/lib/barcodeLookup.ts`
- `asporto-app/src/lib/magazzino.ts`
- `asporto-app/src/lib/publicMenuSync.ts`
- `asporto-app/src/lib/turni.ts`
- `asporto-app/src/lib/dateUtils.ts`
- `menu-pubblico/` (progetto separato: `index.html`, `api/publish-menu.js`, `package.json`, `schema.sql`, `README.md`)
- `supabase/migrations/20260806000000_magazzino.sql`
- `supabase/migrations/20260809000000_magazzino_barcode.sql`

### Modificati (rispetto all'ultimo commit `213e39c`)
- `asporto-app/src/components/MagazzinoView.tsx` — integrato scanner barcode (dopo la creazione iniziale)
- `asporto-app/src/components/MenuQRView.tsx` — aggiunto QR WiFi
- `asporto-app/src/components/SettingsView.tsx` — sezione "Menu Online"
- `asporto-app/src/lib/appSettings.ts` — nuove chiavi settings per publish menu
- `asporto-app/src/lib/magazzino.ts` — supporto `codice_a_barre`
- `asporto-app/src/types/entities.ts` — campo `codice_a_barre` su `MagazzinoArticolo`
- `asporto-app/package.json` / `package-lock.json` — aggiunta dipendenza `html5-qrcode`

### Già committati e pushati (commit `213e39c`, `0770872`)
37 file modificati in totale nelle sessioni precedenti — tra i principali: `App.tsx`, `POSView.tsx`, `WaiterMobileView.tsx`, `StaffDashboard.tsx`, `StaffPinGuard.tsx`, `AdminView.tsx`, `staffAuth.ts`, `OfflineSync.ts`, `orderCarrelloMap.ts`, `vite.config.ts` (fix jsdom). Storia completa: `git log --oneline`, diff completo: `git diff 826fcf9 213e39c`.

**Stato git al momento di scrivere questo file**: branch `main`, allineato con `origin/main` fino al commit `213e39c`; le modifiche elencate sopra come "nuovi/modificati" sono ancora locali, non pushate (l'utente pusha manualmente quando decide).
