--
-- Magazzino: articoli di scorta (ingredienti/materiali) + storico movimenti carico/scarico.
-- Riusa haccp_fornitori come anagrafica fornitori (già esistente).
--

CREATE TABLE public.magazzino_articoli (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    categoria text DEFAULT ''::text NOT NULL,
    unita_misura text DEFAULT 'pz'::text NOT NULL,
    quantita numeric(10,2) DEFAULT 0 NOT NULL,
    soglia_minima numeric(10,2) DEFAULT 0 NOT NULL,
    costo_unitario numeric(10,2) DEFAULT 0 NOT NULL,
    fornitore_id uuid,
    note text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.magazzino_articoli
    ADD CONSTRAINT magazzino_articoli_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.magazzino_articoli
    ADD CONSTRAINT magazzino_articoli_fornitore_id_fkey FOREIGN KEY (fornitore_id) REFERENCES public.haccp_fornitori(id) ON DELETE SET NULL;

CREATE TABLE public.magazzino_movimenti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    articolo_id uuid NOT NULL,
    tipo text NOT NULL,
    quantita numeric(10,2) NOT NULL,
    nota text DEFAULT ''::text NOT NULL,
    operatore text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT magazzino_movimenti_tipo_check CHECK ((tipo = ANY (ARRAY['carico'::text, 'scarico'::text])))
);

ALTER TABLE ONLY public.magazzino_movimenti
    ADD CONSTRAINT magazzino_movimenti_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.magazzino_movimenti
    ADD CONSTRAINT magazzino_movimenti_articolo_id_fkey FOREIGN KEY (articolo_id) REFERENCES public.magazzino_articoli(id) ON DELETE CASCADE;

--
-- Registra un movimento di carico/scarico e aggiorna la quantità corrente in un'unica
-- transazione (evita race condition tra due letture/scritture separate dal client).
--
CREATE OR REPLACE FUNCTION public.magazzino_registra_movimento(
    p_articolo_id uuid,
    p_tipo text,
    p_quantita numeric,
    p_nota text DEFAULT '',
    p_operatore text DEFAULT ''
) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF p_tipo NOT IN ('carico', 'scarico') THEN
    RAISE EXCEPTION 'tipo movimento non valido: %', p_tipo;
  END IF;
  IF p_quantita <= 0 THEN
    RAISE EXCEPTION 'quantita deve essere positiva';
  END IF;

  INSERT INTO public.magazzino_movimenti (articolo_id, tipo, quantita, nota, operatore)
  VALUES (p_articolo_id, p_tipo, p_quantita, p_nota, p_operatore);

  IF p_tipo = 'carico' THEN
    UPDATE public.magazzino_articoli SET quantita = quantita + p_quantita, updated_at = now() WHERE id = p_articolo_id;
  ELSE
    UPDATE public.magazzino_articoli SET quantita = GREATEST(0, quantita - p_quantita), updated_at = now() WHERE id = p_articolo_id;
  END IF;
END;
$$;

ALTER TABLE public.magazzino_articoli ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.magazzino_movimenti ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all ON public.magazzino_articoli USING (true) WITH CHECK (true);
CREATE POLICY allow_all ON public.magazzino_movimenti USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.magazzino_articoli TO anon, authenticated, service_role, authenticator;
GRANT ALL ON TABLE public.magazzino_movimenti TO anon, authenticated, service_role, authenticator;
GRANT EXECUTE ON FUNCTION public.magazzino_registra_movimento(uuid, text, numeric, text, text) TO anon, authenticated;
