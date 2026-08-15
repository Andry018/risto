# Comande Agriturismo — app standalone

App separata, non tocca nulla del progetto del ristorante principale (`asporto-app`). Nessun database esterno: tutto lo stato (menù e tavoli) vive in un file `state.json` sul PC dove gira il server.

## Come funziona (in breve)

```
Telefono/i (WiFi)  --->  PC con la stampante USB collegata
  apri l'app da           - esegue server.js (il "cervello": tiene
  browser, fai la           tavoli/menù, riceve le comande)
  comanda, tocchi          - ha aperta la pagina stampa.html in Chrome
  "Manda in cucina"          (la "mano": stampa davvero, in automatico)
  o "Stampa conto"
```

Il telefono **non stampa direttamente**: manda l'ordine al server, il server lo mette in coda, e la pagina `stampa.html` aperta sul PC con la stampante la preleva e la stampa da sola, senza bisogno di toccare nulla.

## Setup (da fare una volta, con calma, prima del servizio)

### 1. Installa la stampante come stampante Windows
Collega la termica USB al PC che resterà acceso in cucina/cassa per tutto il servizio. Installa il suo driver Windows (quasi tutte le termiche USB ne hanno uno — CD/chiavetta in dotazione o sito del produttore), così compare in "Dispositivi e stampanti" come stampante normale.

Poi, nelle preferenze di stampa di quella stampante, imposta il formato carta su scontrino (80mm o 58mm continuo, non A4) — altrimenti Windows stampa una pagina A4 con lo scontrino piccolo in un angolo. Infine impostala come **stampante predefinita**.

### 2. Installa Node.js sul PC con la stampante (se non c'è già)
Serve solo per far girare `server.js`. Scarica ed installa da nodejs.org (versione LTS). Non serve altro: il server non ha dipendenze da installare (`npm install` non serve, è scritto solo con librerie incluse in Node).

### 3. Trova l'IP del PC con la stampante sulla rete WiFi del locale
Apri il prompt dei comandi su quel PC e digita:

```bash
ipconfig
```

Cerca la riga "Indirizzo IPv4" della scheda WiFi (es. `192.168.1.7`). Ti servirà per collegarti da telefono.

### 4. Avvia il server
Doppio click su [avvia_server.bat](avvia_server.bat). Si apre una finestra nera che deve restare aperta per tutto il servizio — se la chiudi, i telefoni non riescono più a fare comande. La finestra stampa anche l'indirizzo da usare da telefono, per sicurezza.

### 5. Avvia la stazione di stampa (sullo stesso PC)
Doppio click su [avvia_stampa.bat](avvia_stampa.bat) — apre Chrome in modalità speciale che stampa da solo, senza finestre di conferma, appena arriva una comanda. Tieni anche questa finestra aperta (può stare ridotta a icona).

### 6. Collega il/i telefoni
Sul telefono (connesso alla **stessa rete WiFi** del PC), apri il browser e vai su:

```
http://<IP-DEL-PC>:4000/
```

sostituendo `<IP-DEL-PC>` con l'indirizzo trovato al passo 3 (es. `http://192.168.1.7:4000/`). Consiglio: salvalo tra i preferiti o crea un'icona in home screen ("Aggiungi a schermata Home" dal menu del browser) così si apre come un'app.

### 7. Prova prima di aprire
Fai un ordine di prova da telefono su un tavolo, tocca "Manda in cucina": verifica che sul PC parta la stampa da sola entro 1-2 secondi. Poi prova anche "Stampa conto". Se non stampa, controlla che entrambe le finestre (server e stazione di stampa) siano ancora aperte, e che il telefono sia sulla stessa rete WiFi.

## Cosa fa l'app

- **Tavoli**: lista di tavoli (6 già pronti, aggiungine altri col nome che vuoi — anche "Asporto 1" ecc.). Ogni tavolo ha la sua comanda indipendente; più telefoni vedono e possono lavorare sugli stessi tavoli (si aggiornano ogni ~2 secondi).
- **Coperti** distinti tra adulti e bambini, per tavolo.
- Presa comanda: categorie e piatti, quantità, note e "portata" (uscita) per piatto.
- **Manda in cucina**: stampa solo le voci non ancora inviate — se aggiungi altro dopo, la volta successiva stampa solo il nuovo, non ripete tutto. Le voci col puntino 🔸 nel carrello sono quelle non ancora mandate.
- **Stampa conto**: stampa il conto completo del tavolo, ripetibile quante volte vuoi.
- **Chiudi tavolo**: svuota la comanda dopo il pagamento, pronto per il prossimo cliente.
- **Modifica menù** (pulsante in alto): aggiungi/rinomina/elimina categorie e piatti, cambia prezzi, direttamente dall'app — niente bisogno di toccare codice. Il menù è condiviso da tutti i telefoni (salvato sul server, non sul singolo telefono). "Ripristina default" riporta il menù ai valori di partenza.

## Limiti voluti (per stare nei tempi di oggi)

- Se il PC del server si riavvia o `server.js` si chiude, i tavoli aperti restano salvati su disco (`state.json`) e li ritrovi avviandolo di nuovo; solo i lavori di stampa già in coda ma non ancora stampati in quel preciso istante andrebbero ripetuti a mano.
- Serve la stessa rete WiFi per telefono e PC — non funziona da rete dati/4G del telefono.
- Nessuno storico ordini/incassi: se ti serve un totale di fine giornata, tienilo a mano dai foglietti conto o dicci di aggiungerlo dopo.
- Un solo PC può fare da "stazione di stampa" per volta (quello con la stampante USB collegata).
