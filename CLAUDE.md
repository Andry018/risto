# Risto — gestionale ristorante "Il Girasole"

Gestionale per ristorante/pizzeria (sala, POS, cucina, magazzino, HACCP, cassa fiscale).
Lingua del progetto: **italiano** (UI, commenti, commit).

## Struttura
- `asporto-app/` — app principale: React 19 + TypeScript 5.9 + Vite 5 + Tailwind 4, PWA, Capacitor (Android/iOS)
  - `src/components/` — viste: `POSView.tsx` (cassa), `WaiterMobileView.tsx` (cameriere da telefono),
    `StaffDashboard.tsx`, `AdminView.tsx` + `admin/*` (KitchenHub, rotta `/kitchen`), `MagazzinoView.tsx`,
    `ReservationsView.tsx`, `PublicMenuView.tsx` (`/menu`, pubblica)
  - `src/lib/` — logica: `OfflineSync.ts` (syncManager), `staffAuth.ts` (PIN), `dateUtils.ts`, `lanPrint.ts`,
    `ecrAgent.ts`, `appSettings.ts`, `turni.ts`; test in `src/lib/__tests__/` (Vitest)
  - `src/types/entities.ts` — tipi condivisi
  - `menu-lite.html` — menu per Kindle/e-ink: HTML + **JS ES5**, niente React (vedi commento nel file)
  - `print-agent/` (8787, stampante termica), `ecr-agent/` (8788, POS PAX + cassa fiscale), `wa-agent/` (8789, WhatsApp)
- `supabase/migrations/` — schema DB (Supabase self-hosted, Postgres 17)
- `linux/` — deploy sul server: `nginx.conf`, `autopull.sh`, `firewall.sh`, `backup-db.sh`, unità systemd in `services/`
- `admin-server/` — pannello sistema (4000), `telegram-bot/`, `rear-bridge/` + `rear-card/` (schermo posteriore)

## Comandi (da `asporto-app/`)
- `npm run dev` — sviluppo · `npm run build` — `tsc -b && vite build` · `npm test` — Vitest · `npm run lint`
- Senza `.env` la build funziona lo stesso (le variabili `VITE_*` restano segnaposto).

## Deploy — ATTENZIONE
- **Push su `main` = deploy in produzione** entro ~2 minuti (timer `risto-autopull` sul server:
  pull → `npm ci` → build → migrazioni → nginx/systemd). Non c'è CI: build e test vanno fatti prima del push
  (l'hook `.claude/hooks/pre-push-check.js` lo impone).
- `npm ci` gira su Linux: il `package-lock.json` non deve contenere pacchetti obbligatori solo-win32.
- `linux/nginx.conf` viene sincronizzato da autopull solo se passa `nginx -t`.
- Verifica dall'esterno: l'hash `assets/main-*.js` in `https://gestionale.90-minuti.it/index.html` cambia
  quando il nuovo build è online (vedi skill `/verifica-deploy`).
- Commit: messaggi in italiano, **senza** trailer `Co-Authored-By` o altre attribuzioni.

## Regole di codice (bug già successi)
- **Date**: sempre `toLocalISODate()` da `src/lib/dateUtils.ts`, **mai** `toISOString().slice(0,10)` (sfasa di un giorno).
- **Mai definire componenti React dentro un'altra funzione/componente** (es. `const Card = () => …` dentro
  `SettingsView`): rimonta a ogni render e fa perdere il focus agli input. Componenti a livello di modulo.
- **Nessun codice dopo un `return`**: `allowUnreachableCode: false` in tsconfig. Il minificatore elimina il codice
  irraggiungibile → `X is not defined` in produzione (successo con `stockByProdotto` nel POS).
- `Dialog.tsx`: le callback passate inline (`onClose={() => …}`) cambiano a ogni render; negli effetti usare un ref,
  non metterle nelle dipendenze (rubava il focus agli input a ogni tasto).
- **Offline-first**: scritture su ordini/tavoli tramite `syncManager.pushOrder()` / `pushTableUpdate()`, non Supabase diretto.
  Ogni INSERT ha un `id` UUID generato dal client (idempotenza).
- **Realtime**: canali Supabase con cleanup nel `return` dell'`useEffect`. Un evento generato dalla propria scrittura
  torna indietro: i reload da realtime non devono sovrascrivere un carrello con modifiche non salvate
  (`skipIfDirty` / `force=false` + `hasUnsavedChanges()`), altrimenti si perdono righe (es. il COPERTO).
- Il COPERTO è un prodotto (`nome = 'COPERTO'`, categoria `Servizio`) aggiunto al carrello all'apertura del tavolo;
  le righe `Servizio` non vanno in stampa comanda.
- IVA di default 10%.
- `menu-lite.html` deve restare ES5 (niente `const`/arrow/template string/fetch): gira sui browser vecchi del Kindle.

## Database e sicurezza
- **RLS su tutte le tabelle `public`**: policy `staff_all` `TO authenticated USING ((SELECT is_staff()))`.
  Il ruolo `anon` può solo: SELECT su `prodotti`, `ingredienti`, `impostazioni`; rpc `etichetta_pubblica`, `staff_login`.
- **Ogni nuova tabella**: abilitare RLS + policy `staff_all` nella migrazione, e se serve realtime aggiungerla alla
  publication `supabase_realtime` (usa la skill `/nuova-migrazione`).
- La chiave anon è pubblica (sta nel bundle): qualunque cosa leggibile da anon è pubblica.
  **Mai segreti in `impostazioni`**: i segreti stanno solo in localStorage (`LOCAL_ONLY_KEYS` in `appSettings.ts`)
  o nei `.env` degli agent.
- Auth staff: PIN verificato dal server (`staff_verify_pin`, hash bcrypt), il client riceve un JWT staff
  (`iss=risto-staff`). Tutte le rotte staff stanno dentro `<Route element={<StaffPinGuard/>}>`.
- Non modificare `.env`, keystore o `package-lock.json` a mano (bloccato da `.claude/hooks/protect-files.js`).

## Hardware / contesto
- La cucina **non ha schermo**: lavora con le comande stampate (niente suoni/notifiche in cucina).
- POS PAX A35 (Nexi, protocollo ECR17) e cassa Custom (protocollo da definire): vedi `ecr-agent/`.
