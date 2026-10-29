-- Aggiornamenti in tempo reale: l'app ascolta questi canali (postgres_changes) ma sul CT la
-- publication conteneva solo le tabelle del magazzino, quindi i tablet non ricevevano nulla
-- e si aggiornavano solo ricaricando. Le RLS valgono anche qui: lo staff riceve tutto,
-- le pagine pubbliche solo prodotti/ingredienti (disponibilità nel menu).
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tavoli', 'ordini', 'prenotazioni', 'prodotti', 'ingredienti'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
