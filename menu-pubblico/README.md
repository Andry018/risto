# Menu Pubblico — Il Girasole

Sito statico + endpoint di pubblicazione per mostrare il menu online, raggiungibile da
chiunque senza essere collegati al WiFi del locale. Usa un progetto Supabase Cloud
separato da quello del ristorante (contiene solo i piatti disponibili, nessun dato
sensibile).

## Deploy su Vercel

1. Su [vercel.com](https://vercel.com), **New Project** → importa questa cartella
   (`menu-pubblico/`) dal repository.
2. In **Settings → Environment Variables** aggiungi (solo lato server, mai nel codice):
   - `SUPABASE_URL` → l'URL del progetto Supabase Cloud (es. `https://xxxxx.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` → la **service_role key** (Project Settings → API →
     `service_role`, **non** la `anon`). Non condividerla mai altrove, non committarla.
   - `PUBLISH_SECRET` → una password a scelta, lunga e casuale (es. generata con
     `openssl rand -hex 32`). Serve solo per far comunicare l'app locale con questo
     endpoint — va inserita anche nelle Impostazioni dell'app locale.
3. Deploy. Vercel assegna un dominio tipo `girasole-menu.vercel.app`.

## Collegare il tuo dominio

In **Settings → Domains** del progetto Vercel, aggiungi il tuo dominio (o un
sottodominio, es. `menu.tuodominio.it`) e segui le istruzioni per il record DNS che
Vercel ti mostra (di solito un CNAME verso `cname.vercel-dns.com`).

## Schema del database

Prima del primo utilizzo, esegui `schema.sql` nell'SQL Editor del progetto Supabase
Cloud (Studio → SQL Editor → incolla il contenuto → Run).

## Come funziona

- `index.html` legge `prodotti_pubblico` in sola lettura (chiave anon, pubblica per
  progettazione — la sicurezza è nelle policy RLS, non nel nascondere la chiave).
- `api/publish-menu.js` è l'unico modo per scrivere: richiede l'header
  `x-publish-secret` che deve corrispondere a `PUBLISH_SECRET`, e usa la
  `service_role` key (mai esposta al browser) per superare la RLS di sola lettura.
- Dall'app locale, il pulsante "Pubblica menu online" (Impostazioni) invia lo
  snapshot corrente dei piatti disponibili a questo endpoint, che sostituisce
  interamente il contenuto pubblico.

Il menu online **non è in tempo reale**: si aggiorna solo quando premi "Pubblica".
Va bene per il menu del giorno, non per la disponibilità minuto per minuto.
