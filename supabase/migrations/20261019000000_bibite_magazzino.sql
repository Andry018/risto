--
-- Collega le bibite/prodotti del POS alle scorte di magazzino.
-- 1 prodotto  ->  1 articolo di magazzino (prodotto_id).
-- target_frigo: quanti pezzi dovrebbero stare nel frigo (per il rifornimento "Da Caricare").
-- Le vendite scalano automaticamente la giacenza tramite trigger su ordini.carrello.
--

ALTER TABLE public.magazzino_articoli
    ADD COLUMN IF NOT EXISTS prodotto_id uuid,
    ADD COLUMN IF NOT EXISTS target_frigo numeric(10,2) DEFAULT 0 NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'magazzino_articoli_prodotto_id_fkey') THEN
    ALTER TABLE ONLY public.magazzino_articoli
      ADD CONSTRAINT magazzino_articoli_prodotto_id_fkey
      FOREIGN KEY (prodotto_id) REFERENCES public.prodotti(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Un prodotto puo' essere collegato a un solo articolo di magazzino.
CREATE UNIQUE INDEX IF NOT EXISTS magazzino_articoli_prodotto_id_key
    ON public.magazzino_articoli (prodotto_id)
    WHERE prodotto_id IS NOT NULL;

--
-- Trigger: quando un ordine viene salvato, scala le scorte degli articoli collegati
-- alle bibite vendute (delta rispetto alla versione precedente). Se una riga viene
-- rimossa o l'ordine cancellato, la scorta viene ripristinata.
--
CREATE OR REPLACE FUNCTION public.ordini_scala_magazzino() RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
DECLARE
  v_new jsonb;
  v_old jsonb;
  v_nome text;
  v_newqty numeric;
  v_oldqty numeric;
  v_delta numeric;
  v_prodotto_id uuid;
  v_articolo_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_new := '[]'::jsonb;
    v_old := COALESCE(OLD.carrello, '[]'::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.carrello IS NOT DISTINCT FROM OLD.carrello THEN
      RETURN NEW;
    END IF;
    v_new := COALESCE(NEW.carrello, '[]'::jsonb);
    v_old := COALESCE(OLD.carrello, '[]'::jsonb);
  ELSE
    v_new := COALESCE(NEW.carrello, '[]'::jsonb);
    v_old := '[]'::jsonb;
  END IF;

  FOR v_nome IN
    SELECT DISTINCT (elem->>'nome')
    FROM jsonb_array_elements(v_new || v_old) AS elem
    WHERE (elem->>'nome') IS NOT NULL AND (elem->>'nome') <> ''
  LOOP
    SELECT COALESCE(SUM(COALESCE((elem->>'quantity')::numeric, 1)), 0)
      INTO v_newqty
      FROM jsonb_array_elements(v_new) AS elem
      WHERE (elem->>'nome') = v_nome;

    SELECT COALESCE(SUM(COALESCE((elem->>'quantity')::numeric, 1)), 0)
      INTO v_oldqty
      FROM jsonb_array_elements(v_old) AS elem
      WHERE (elem->>'nome') = v_nome;

    v_delta := v_newqty - v_oldqty;   -- > 0 venduto, < 0 ripristinato
    CONTINUE WHEN v_delta = 0;

    SELECT p.id INTO v_prodotto_id FROM public.prodotti p WHERE lower(p.nome) = lower(v_nome) LIMIT 1;
    CONTINUE WHEN v_prodotto_id IS NULL;

    SELECT a.id INTO v_articolo_id FROM public.magazzino_articoli a WHERE a.prodotto_id = v_prodotto_id LIMIT 1;
    CONTINUE WHEN v_articolo_id IS NULL;

    IF v_delta > 0 THEN
      INSERT INTO public.magazzino_movimenti (articolo_id, tipo, quantita, nota, operatore)
      VALUES (v_articolo_id, 'scarico', v_delta, 'Vendita ' || v_nome, 'sistema');
      UPDATE public.magazzino_articoli
        SET quantita = GREATEST(0, quantita - v_delta), updated_at = now()
        WHERE id = v_articolo_id;
    ELSE
      INSERT INTO public.magazzino_movimenti (articolo_id, tipo, quantita, nota, operatore)
      VALUES (v_articolo_id, 'carico', -v_delta, 'Ripristino ' || v_nome, 'sistema');
      UPDATE public.magazzino_articoli
        SET quantita = quantita + (-v_delta), updated_at = now()
        WHERE id = v_articolo_id;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ordini_scala_magazzino ON public.ordini;
CREATE TRIGGER trg_ordini_scala_magazzino
    AFTER INSERT OR UPDATE OR DELETE ON public.ordini
    FOR EACH ROW EXECUTE FUNCTION public.ordini_scala_magazzino();

-- Realtime (best-effort: ignora se la publication non esiste o la tabella e' gia' presente).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.magazzino_articoli;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.magazzino_movimenti;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL;
END $$;
