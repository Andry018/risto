# Risto — App per ristoranti

Gestione sala, asporto, POS, cucina, fatture e prenotazioni. PWA con supporto tablet, mobile e Capacitor.

## Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS 4, Lucide React
- **Backend:** Supabase (PostgreSQL, Realtime, Storage, Auth)
- **Stampa termica:** Print-agent Node.js (node-thermal-printer)
- **Mobile:** Capacitor 8 (Android/iOS)
- **PWA:** vite-plugin-pwa

## Setup locale

### 1. Prerequisiti

- Node.js 18+
- Supabase CLI (`npm install -g supabase`)
- Git

### 2. Clona e installa

```bash
git clone <repo>
cd asporto-app
npm install
```

### 3. Variabili d'ambiente

Copia `.env.example` in `.env`:

```bash
cp .env.example .env
```

| Variabile | Descrizione | Default |
|---|---|---|
| `VITE_SUPABASE_URL` | URL istanza Supabase | `http://127.0.0.1:54321` |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase | (vuoto — usato default locale) |
| `VITE_STAFF_PIN` | PIN operatore (produzione) | — |

### 4. Avvia Supabase (locale)

```bash
supabase start
```

Applica le migration:

```bash
supabase db push
```

L'istanza locale sarà su `http://127.0.0.1:54321` (API), Studio su `http://127.0.0.1:54323`.

### 5. Avvia il frontend

```bash
npm run dev
```

Apri `http://localhost:5173`.

### 6. Print-agent (stampa termica)

```bash
cd print-agent
cp .env.example .env   # configura SUPABASE_URL e SUPABASE_ANON_KEY
npm install
node index.js
```

L'agente ascolta su `http://127.0.0.1:8787` e stampa le comande su stampante termica di rete.

### 7. Modalità demo

Senza Supabase, puoi abilitare la demo:

```js
localStorage.setItem('demo_mode', 'true');
window.location.reload();
```

## Flussi principali

### Sala (camerieri)

`/waiter` — Vista mobile per camerieri:
- Mappa tavoli interattiva
- Presa ordini con personalizzazione (aggiunte/rimozioni ingredienti, portate)
- Invio comanda in cucina
- Gestione prenotazioni

### Asporto

`/asporto` — Vista cliente per ordini take-away:
- Navigazione menu
- Carrello con modifiche
- Riepilogo e conferma ordine

`/takeaway` — Vista tablet per gestire ordini asporto in arrivo

### POS (cassa)

`/pos` — Punto cassa:
- Chiusura conti tavolo
- Pagamento (contanti/carta)
- Sconti e modifiche
- Liberazione tavoli

### Cucina

`/kitchen` — Vista cucina:
- Ordini in arrivo in tempo reale
- Stato avanzamento portate
- Completamento ordini

### Fatture

`/pos` (modale fattura) — Generazione fatture:
- Collegate a ordini o manuali
- PDF con jspdf
- Upload su Supabase Storage
- Storico e condivisione

### Admin

`/admin` (da tablet) — Pannello amministrazione:
- Gestione prodotti, ingredienti, categorie
- Gestione tavoli e sale
- Gestione staff (PIN, ruoli)
- Report e chiusura giornata

## Deploy

### Web (Vite)

```bash
npm run build
```

Il build va in `dist/`. Deploya su qualsiasi host statico (Netlify, Vercel, Cloudflare Pages).

### PWA

Il build produce già un service worker. Su mobile, "Aggiungi alla homescreen" per esperienza app-like.

### Capacitor (Android/iOS)

```bash
npx cap add android
npx cap add ios
npm run build
npx cap sync
npx cap open android   # o ios
```

## Scripts

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server |
| `npm run dev:lan` | Dev server in rete locale |
| `npm run build` | TypeScript check + build Vite |
| `npm run lint` | ESLint |
| `npm run preview` | Preview del build |

## Architettura

```
src/
├── components/        # UI components
├── hooks/             # React hooks (useOrders, useProducts, etc.)
├── lib/               # Utility (staffAuth, supabase, printUtils, etc.)
├── types/             # TypeScript types
├── data/              # Mock data
└── main.tsx           # Entry point
```

## License

MIT
