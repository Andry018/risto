# Kindle — Menu Girasole

Il Kindle (11ª gen, jailbreak + KOReader) usato come lavagna del menu del giorno.

- **Apri**: nella Libreria del Kindle tocca **"Menu Girasole"** (ha il logo come copertina).
  KOReader si apre direttamente sul menu a schermo intero, senza barre.
- **Aggiornamento**: ogni 30 secondi scarica il menu dal gestionale; lo schermo si ridisegna solo se i piatti
  cambiano (piatto esaurito, nuovo piatto…). Se il menu non sta in una schermata, le pagine girano ogni 20 s.
- **Standby**: finché il menu è aperto il Kindle non si spegne da solo. Col tasto di accensione si spegne e
  mostra **l'ultimo menu** (oppure il **logo**: si sceglie dalla pressione lunga). Da spento non si aggiorna.
- **Barra in basso**: bandiere 🇮🇹/🇬🇧 per la lingua (quella attiva ha il bordo spesso), **a** / **A** per
  rimpicciolire/ingrandire il testo, e se il menu ha più pagine **‹ 1/2 ›** per sfogliarle.
- **Pressione lunga** sullo schermo: "Torna al Kindle", "In standby: menu/logo", "Testo: normale/grande/molto grande",
  "Lingua: Italiano/English", "Resta sul menu". Testo e lingua restano salvati sul Kindle (default: normale, italiano).
  Con il testo grande il menu può andare su più pagine: girano da sole ogni 20 s, oppure si sfogliano col dito
  (sinistra/su = avanti, destra/giù = indietro; dopo uno sfoglio il giro automatico si ferma 1 minuto).
  Il tocco semplice non fa nulla (clienti).
- All'uscita il salvaschermo torna quello di prima (anche se KOReader si era chiuso male: al riavvio).

## Cosa mostra
L'immagine la genera il print agent del gestionale:
`https://gestionale.90-minuti.it/print-agent/kindle/menu?cat=Antipasti,Primi,Secondi,Contorni,Dolci`

Parametri: `cat` (categorie, separate da virgola), `ingr=0` (senza ingredienti), `prezzi=0` (senza prezzi),
`zoom=1.2` (testo più grande), `lang=en` (intestazione e categorie in inglese).
Per cambiarli, in KOReader → `settings.reader.lua` aggiungi:
```lua
["menugirasole_url"] = "https://gestionale.90-minuti.it/print-agent/kindle/menu?cat=Primi,Secondi",
```
Anteprima dal PC: apri l'URL sopra nel browser. Usa sempre l'indirizzo senza `.png` (Cloudflare metterebbe in cache i .png).

## Installazione (via SSH/SFTP, porta 2222)
- `menugirasole.koplugin/` → `/mnt/us/koreader/plugins/menugirasole.koplugin/`
- `Menu Girasole.sh` → `/mnt/us/documents/Menu Girasole.sh`

Poi riavvia KOReader una volta. Log del plugin: `/mnt/us/koreader/crash.log` (righe `MenuGirasole`).

## Note
- Se Amazon aggiorna il firmware e il jailbreak si perde, lo scriptlet smette di funzionare: rifare il jailbreak.
- Server: `asporto-app/print-agent/kindleMenu.js` (immagini) + rotte `/kindle/*` in `print-agent/index.js`.
