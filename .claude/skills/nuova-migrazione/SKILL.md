---
name: nuova-migrazione
description: Crea una nuova migrazione Supabase per Risto con RLS, policy staff_all e (se serve) realtime già impostati. Usala quando serve una nuova tabella, colonna, funzione o policy nel DB.
disable-model-invocation: true
argument-hint: "<descrizione breve, es. tabella fornitori>"
---

# Nuova migrazione Supabase (Risto)

Richiesta: $ARGUMENTS

## Passi
1. Guarda le ultime migrazioni in `supabase/migrations/` per lo stile e il formato del nome
   (`YYYYMMDDNNNNNN_descrizione.sql`, data di oggi, numero progressivo se ce ne sono altre nello stesso giorno).
2. Scrivi la migrazione **idempotente** (`IF NOT EXISTS`, `DROP POLICY IF EXISTS` prima di `CREATE POLICY`).
3. Per **ogni nuova tabella in `public`** includi SEMPRE:
   ```sql
   ALTER TABLE public.<tabella> ENABLE ROW LEVEL SECURITY;
   DROP POLICY IF EXISTS staff_all ON public.<tabella>;
   CREATE POLICY staff_all ON public.<tabella>
     FOR ALL TO authenticated
     USING ((SELECT is_staff())) WITH CHECK ((SELECT is_staff()));
   ```
   - `id uuid PRIMARY KEY DEFAULT gen_random_uuid()` (il client manda comunque il suo UUID: idempotenza).
   - Date di servizio come `DATE`, timestamp come `timestamptz DEFAULT now()`.
4. **Accesso anon**: di default NESSUNO. Concedilo solo se l'utente lo chiede esplicitamente e spiega cosa diventa
   pubblico (la chiave anon è nel bundle). Mai dati personali o segreti leggibili da anon.
5. **Realtime**: se l'app deve ricevere aggiornamenti live sulla tabella, aggiungila alla publication:
   ```sql
   DO $$ BEGIN
     ALTER PUBLICATION supabase_realtime ADD TABLE public.<tabella>;
   EXCEPTION WHEN duplicate_object THEN NULL; END $$;
   ```
6. Aggiorna i tipi in `asporto-app/src/types/entities.ts` se la tabella è usata dall'app.
7. Fai rivedere la migrazione dall'agent `rls-reviewer` prima del commit.
8. Ricorda all'utente: la migrazione si applica in automatico al deploy (autopull); un errore SQL blocca il deploy.
