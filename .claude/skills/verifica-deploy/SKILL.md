---
name: verifica-deploy
description: Controlla che l'ultimo push su main sia online su gestionale.90-minuti.it (bundle nuovo servito, file attesi presenti). Usala dopo un push o quando l'utente chiede se un aggiornamento è arrivato.
disable-model-invocation: true
argument-hint: "[testo o file da cercare nel bundle nuovo]"
---

# Verifica deploy

Il deploy avviene da solo: timer `risto-autopull` sul server ogni ~2 minuti (pull → build → migrazioni).
Cerca in particolare: $ARGUMENTS

## Controllo pubblico (funziona sempre, niente SSH)
1. Annota l'ultimo commit: `git log --oneline -1`.
2. Leggi il bundle servito ora:
   `curl -s https://gestionale.90-minuti.it/index.html | grep -o 'assets/main-[^"]*\.js'`
3. In background (`run_in_background`), ripeti ogni 20 s per max ~8 minuti finché l'hash cambia, poi scarica il
   nuovo `main-*.js` e cerca una stringa introdotta dal commit (un testo UI, un nome di colonna, un commento non
   minificato non c'è: usa stringhe letterali). Per file statici (es. `menu-lite.html`) basta `curl -sI` + contenuto.
4. Se dopo ~8 minuti l'hash non cambia: probabilmente la build sul server è fallita.

## Controllo dal server (solo se SSH/Tailscale è raggiungibile)
- `ssh risto-pve "pct exec 100 -- tail -n 60 /opt/risto/logs/autopull.log"` per vedere errori di build/migrazioni.
- Se SSH va in timeout, dillo all'utente (Tailscale spento sul PC) e resta sul controllo pubblico.

## Report
Di' chiaramente: commit atteso, hash vecchio → nuovo, cosa hai verificato nel bundle, e se c'è qualcosa che
l'utente deve fare (es. ricaricare/chiudere l'app sul tablet per il service worker).
