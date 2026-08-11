# Backup Database — Risto (Il Girasole)

## Cosa fa

`backup-db.bat` esegue un dump completo (schema + dati) del database Supabase
locale via `supabase db dump --local`, in `C:\risto\backups\db\<timestamp>\`
(`schema.sql` + `data.sql`). Tiene solo gli ultimi 14 giorni, il resto viene
cancellato automaticamente. Ogni esecuzione scrive un log in
`C:\risto\backups\backup_log.txt`.

**Prima di questo script non esisteva nessun backup**: se il PC del locale si
rompe, viene rubato o prende fuoco, oggi si perderebbero tutti gli ordini,
il magazzino e le fatture emesse senza possibilità di recupero.

## Setup (una volta sola, sul PC del locale)

1. Verifica che il container Supabase locale sia attivo (`supabase start` da
   `C:\risto`, o già avviato da `start.bat`).
2. Test manuale:
   ```cmd
   cd /d C:\risto
   backup-db.bat
   ```
   Controlla `C:\risto\backups\db\` — dovrebbe comparire una cartella con
   `schema.sql` e `data.sql` non vuoti.
3. Schedula l'esecuzione automatica (una volta, da CMD **come amministratore**):
   ```cmd
   schtasks /create /tn "RistoBackupDB" /tr "C:\risto\backup-db.bat" /sc daily /st 04:00 /ru SYSTEM /f
   ```
   Gira ogni notte alle 4:00 (fuori orario di servizio). Per cambiare orario,
   sostituisci `04:00`.
4. Verifica che sia stata creata:
   ```cmd
   schtasks /query /tn "RistoBackupDB"
   ```

## IMPORTANTE: un backup solo su C:\risto non basta

Il backup protegge da errori umani o corruzione del database, **non** da un
guasto hardware, furto o incendio del PC — in quei casi si perde anche la
cartella `backups`. Serve una copia su un supporto separato:

- **Più semplice**: una chiavetta USB collegata periodicamente, copiando
  `C:\risto\backups\db\` a mano ogni tanto.
- **Automatico**: una cartella sincronizzata con un cloud (OneDrive, Google
  Drive, Dropbox) — sposta/collega `C:\risto\backups` dentro quella cartella,
  oppure decommenta la riga `robocopy` in fondo a `backup-db.bat` e imposta
  il percorso della destinazione (es. un secondo disco `D:`).

## Come ripristinare un backup (in caso di disastro)

1. Assicurati che l'istanza Supabase locale sia attiva e vuota:
   ```cmd
   cd /d C:\risto
   supabase db reset --local
   ```
2. Applica lo schema, poi i dati (in questo ordine):
   ```cmd
   psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -f "C:\risto\backups\db\<timestamp>\schema.sql"
   psql "postgresql://postgres:postgres@127.0.0.1:54332/postgres" -f "C:\risto\backups\db\<timestamp>\data.sql"
   ```
   (la porta `54332` è quella configurata in `supabase/config.toml`, sezione
   `[db]` — se cambia in futuro, aggiornala anche qui)
3. Riavvia `start.bat` per rigenerare la build frontend e riavviare tutti i
   servizi.

**Consiglio**: testa il ripristino almeno una volta su un ambiente di prova
(non durante un'emergenza reale) così sai già come funziona quando serve
davvero.
