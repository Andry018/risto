--
-- Sicurezza tabelle: il gestionale è raggiungibile da internet e la anon key è nel bundle JS,
-- quindi "anon" = chiunque. Da qui in poi:
--
--   anon (pagine pubbliche, nessun login)
--     - lettura prodotti / ingredienti / impostazioni   (menu pubblico, ordini online)
--     - inserimento ordini online in stato IN_ATTESA    (/asporto)
--     - etichetta HACCP per lotto via etichetta_pubblica() (/etichetta/:lotto)
--     - elenco operatori (solo nome/ruolo) + login PIN   (schermata di accesso)
--
--   staff (dopo il PIN: token firmato da staff_login(), role=authenticated, iss=risto-staff)
--     - tutto il resto
--
-- ATTENZIONE: serve anche un JWT secret NON di default (linux/rotate-jwt-secret.sh),
-- altrimenti chiunque può firmarsi un token valido.
-- Tabelle nuove: hanno RLS attiva solo se la migration la abilita. Usare lo stesso schema:
--   ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
--   CREATE POLICY staff_all ON ... FOR ALL TO authenticated USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()));
--

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;

-- ── Token staff (JWT HS256 firmato con lo stesso secret di PostgREST/Realtime) ──────────

CREATE OR REPLACE FUNCTION private.b64url(p bytea) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(rtrim(replace(encode(p, 'base64'), E'\n', ''), '='), '+/', '-_')
$$;

CREATE OR REPLACE FUNCTION private.sign_staff_token(p_user_id uuid, p_role text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_secret text := current_setting('app.settings.jwt_secret', true);
  v_now bigint := extract(epoch FROM now())::bigint;
  v_head text;
  v_body text;
BEGIN
  IF coalesce(v_secret, '') = '' THEN
    RAISE EXCEPTION 'JWT secret non configurato (app.settings.jwt_secret)';
  END IF;
  v_head := private.b64url(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'));
  v_body := private.b64url(convert_to(json_build_object(
    'role', 'authenticated',
    'aud', 'authenticated',
    'iss', 'risto-staff',
    'sub', p_user_id,
    'staff_role', p_role,
    'iat', v_now,
    'exp', v_now + 30 * 24 * 3600          -- 30 giorni: il tablet resta collegato, l'app lo rinnova
  )::text, 'utf8'));
  RETURN v_head || '.' || v_body || '.' || private.b64url(hmac(v_head || '.' || v_body, v_secret, 'sha256'));
END $$;

-- Operatore del token corrente (solo token emessi da staff_login, non quelli di Supabase Auth)
CREATE OR REPLACE FUNCTION private.staff_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN auth.jwt() ->> 'iss' = 'risto-staff' THEN (auth.jwt() ->> 'sub')::uuid END
$$;

-- Vero solo se il token è di un operatore che esiste ancora: eliminarlo revoca subito l'accesso
CREATE OR REPLACE FUNCTION public.is_staff() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM staff_users WHERE id = private.staff_id())
$$;

-- Login: PIN giusto → token. NULL se il PIN è sbagliato (eccezione se bloccato per troppi tentativi).
CREATE OR REPLACE FUNCTION public.staff_login(p_user_id uuid, p_pin text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_role text;
BEGIN
  IF NOT staff_verify_pin(p_user_id, p_pin) THEN
    RETURN NULL;
  END IF;
  SELECT role INTO v_role FROM staff_users WHERE id = p_user_id;
  RETURN private.sign_staff_token(p_user_id, v_role);
END $$;

-- Rinnovo del token senza PIN (operatore ancora esistente; aggiorna anche il ruolo)
CREATE OR REPLACE FUNCTION public.staff_refresh_token() RETURNS text
LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions AS $$
  SELECT private.sign_staff_token(id, role) FROM staff_users WHERE id = private.staff_id()
$$;

-- ── Etichetta HACCP pubblica (QR sulle confezioni, controlli sanitari) ───────────────────

CREATE OR REPLACE FUNCTION public.etichetta_pubblica(p_lotto text) RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT json_build_object(
    'etichetta', to_json(e),
    'prodotto',  (SELECT to_json(p) FROM haccp_prodotti p WHERE p.id = e.prodotto_id),
    'fornitori', coalesce((
       SELECT json_agg(json_build_object('id', f.id, 'nome', f.nome, 'partita_iva', f.partita_iva, 'telefono', f.telefono))
         FROM haccp_prodotti_fornitori pf JOIN haccp_fornitori f ON f.id = pf.fornitore_id
        WHERE pf.prodotto_id = e.prodotto_id), '[]'::json)
  )
  FROM haccp_etichette e
  WHERE e.lotto = p_lotto
  LIMIT 1
$$;

-- ── Regole sulle tabelle ────────────────────────────────────────────────────────

DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
     WHERE schemaname = 'public' AND tablename NOT IN ('staff_users', 'staff_pin_attempts')
  LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON public.%I', pol, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    EXECUTE format(
      'CREATE POLICY staff_all ON public.%I FOR ALL TO authenticated USING ((SELECT public.is_staff())) WITH CHECK ((SELECT public.is_staff()))',
      t);
  END LOOP;
END $$;

-- Menu pubblico e ordini online: lettura prodotti/ingredienti/impostazioni (i segreti non stanno più lì)
GRANT SELECT ON TABLE public.prodotti, public.ingredienti, public.impostazioni TO anon;
CREATE POLICY public_read ON public.prodotti     FOR SELECT TO anon USING (true);
CREATE POLICY public_read ON public.ingredienti  FOR SELECT TO anon USING (true);
CREATE POLICY public_read ON public.impostazioni FOR SELECT TO anon USING (true);

-- Ordini online (/asporto): solo inserimento di ordini nuovi, niente lettura/modifica
GRANT INSERT (nome_cliente, orario_ritiro, totale, status, carrello) ON TABLE public.ordini TO anon;
CREATE POLICY public_insert_online ON public.ordini FOR INSERT TO anon WITH CHECK (status = 'IN_ATTESA');

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Tabelle e funzioni create in futuro: niente accesso anonimo di default
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, PUBLIC;

-- ── Permessi sulle funzioni ─────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION private.b64url(bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.sign_staff_token(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.staff_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.staff_id() TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

REVOKE ALL ON FUNCTION public.staff_login(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_login(uuid, text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_refresh_token() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_refresh_token() TO authenticated;
REVOKE ALL ON FUNCTION public.etichetta_pubblica(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.etichetta_pubblica(text) TO anon, authenticated;

-- Funzioni dell'app: solo staff (le RLS valgono comunque, sono SECURITY INVOKER)
REVOKE ALL ON FUNCTION public.next_doc_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_doc_number() TO authenticated;
DO $$
BEGIN
  -- firma non nota a priori: revoca su tutte le varianti
  EXECUTE (
    SELECT string_agg(format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon; GRANT EXECUTE ON FUNCTION %s TO authenticated;', p.oid::regprocedure, p.oid::regprocedure), ' ')
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'magazzino_registra_movimento'
  );
END $$;
-- Funzioni dei trigger: non vanno chiamate da fuori
REVOKE ALL ON FUNCTION public.ordini_scala_magazzino() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_impostazioni_updated_at() FROM PUBLIC, anon, authenticated;
