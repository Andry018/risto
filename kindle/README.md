# Kindle — Menu Girasole

Il Kindle (11ª gen, jailbreak + KOReader) usato come lavagna del menu del giorno.

- **Apri**: nella Libreria del Kindle tocca **"Menu Girasole"** (ha il logo come copertina).
  KOReader si apre direttamente sul menu a schermo intero, senza barre.
- **Aggiornamento**: ogni minuto scarica il menu dal gestionale; lo schermo si ridisegna solo se i piatti
  cambiano (piatto esaurito, nuovo piatto…). Se il menu non sta in una schermata, le pagine girano ogni 20 s.
- **Standby**: finché il menu è aperto il Kindle non si spegne da solo. Col tasto di accensione si spegne e
  mostra il **logo del ristorante**.
- **Esci**: tieni premuto lo schermo → "Torna al Kindle". Il tocco semplice non fa nulla (clienti).
  All'uscita il salvaschermo torna quello di prima.

## Cosa mostra
L'immagine la genera il print agent del gestionale:
`http://192.168.1.250/print-agent/kindle/menu.png?cat=Antipasti,Primi,Secondi,Contorni,Dolci`

Parametri: `cat` (categorie, separate da virgola), `ingr=0` (senza ingredienti), `prezzi=0` (senza prezzi).
Per cambiarli, in KOReader → `settings.reader.lua` aggiungi:
```lua
["menugirasole_url"] = "http://192.168.1.250/print-agent/kindle/menu.png?cat=Primi,Secondi",
```
Anteprima dal PC: apri l'URL sopra nel browser (rete del locale).

## Installazione (via SSH/SFTP, porta 2222)
- `menugirasole.koplugin/` → `/mnt/us/koreader/plugins/menugirasole.koplugin/`
- `Menu Girasole.sh` → `/mnt/us/documents/Menu Girasole.sh`

Poi riavvia KOReader una volta. Log del plugin: `/mnt/us/koreader/crash.log` (righe `MenuGirasole`).

## Note
- Se Amazon aggiorna il firmware e il jailbreak si perde, lo scriptlet smette di funzionare: rifare il jailbreak.
- Server: `asporto-app/print-agent/kindleMenu.js` (immagini) + rotte `/kindle/*` in `print-agent/index.js`.
