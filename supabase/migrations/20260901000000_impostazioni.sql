-- Tabella impostazioni centralizzate (cross-device)
-- Sostituisce il localStorage per le configurazioni del ristorante.
-- Ogni chiave è univoca; il valore è sempre testo (cast lato applicazione).

CREATE TABLE public.impostazioni (
  chiave      text        PRIMARY KEY,
  valore      text        NOT NULL DEFAULT '',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Aggiorna updated_at ad ogni modifica
CREATE OR REPLACE FUNCTION public.set_impostazioni_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_impostazioni_updated_at
  BEFORE UPDATE ON public.impostazioni
  FOR EACH ROW EXECUTE FUNCTION public.set_impostazioni_updated_at();

-- RLS: accesso libero (le impostazioni non contengono dati sensibili di terzi)
ALTER TABLE public.impostazioni ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON public.impostazioni USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.impostazioni TO anon;
GRANT ALL ON TABLE public.impostazioni TO authenticated;
GRANT ALL ON TABLE public.impostazioni TO service_role;
GRANT ALL ON TABLE public.impostazioni TO authenticator;
