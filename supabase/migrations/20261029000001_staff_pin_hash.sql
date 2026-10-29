--
-- PIN dello staff: da testo in chiaro (leggibile e modificabile da chiunque con la anon key pubblica)
-- a hash bcrypt verificato solo sul server.
--
--  - dal browser si leggono solo id, nome e ruolo
--  - login:              staff_verify_pin(user_id, pin)
--  - PIN responsabile:   staff_check_admin_pin(pin)          (PIN di un qualsiasi amministratore)
--  - gestione operatori: staff_save / staff_delete            (richiedono il PIN di un amministratore)
--  - massimo 5 PIN sbagliati ogni 15 minuti per operatore (e per il PIN responsabile)
--

ALTER TABLE public.staff_users ADD COLUMN IF NOT EXISTS pin_hash text;
UPDATE public.staff_users
   SET pin_hash = extensions.crypt(trim(pin), extensions.gen_salt('bf', 8))
 WHERE pin_hash IS NULL;
ALTER TABLE public.staff_users ALTER COLUMN pin_hash SET NOT NULL;
ALTER TABLE public.staff_users DROP COLUMN pin;

-- Accesso diretto: solo lettura delle colonne non sensibili
DROP POLICY IF EXISTS allow_all ON public.staff_users;
REVOKE ALL ON TABLE public.staff_users FROM anon, authenticated;
GRANT SELECT (id, name, role, created_at) ON TABLE public.staff_users TO anon, authenticated;
CREATE POLICY staff_users_read ON public.staff_users FOR SELECT USING (true);

-- Tentativi di PIN (per il limite anti-forza bruta). Nessun accesso dal browser.
CREATE TABLE IF NOT EXISTS public.staff_pin_attempts (
    user_id uuid NOT NULL,
    at timestamptz NOT NULL DEFAULT now(),
    ok boolean NOT NULL
);
CREATE INDEX IF NOT EXISTS staff_pin_attempts_user_at_idx ON public.staff_pin_attempts (user_id, at DESC);
ALTER TABLE public.staff_pin_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.staff_pin_attempts FROM anon, authenticated;

-- Chiave usata per limitare i tentativi del PIN responsabile (non è un operatore)
-- 00000000-0000-0000-0000-000000000000

CREATE OR REPLACE FUNCTION public._staff_too_many_attempts(p_key uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) >= 5 FROM staff_pin_attempts
   WHERE user_id = p_key AND NOT ok AND at > now() - interval '15 minutes';
$$;

CREATE OR REPLACE FUNCTION public._staff_record_attempt(p_key uuid, p_ok boolean) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM staff_pin_attempts WHERE at < now() - interval '1 day';
  INSERT INTO staff_pin_attempts (user_id, ok) VALUES (p_key, p_ok);
$$;

-- Login operatore. Errore (eccezione) solo se bloccato per troppi tentativi.
CREATE OR REPLACE FUNCTION public.staff_verify_pin(p_user_id uuid, p_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_hash text;
  v_ok boolean;
BEGIN
  IF _staff_too_many_attempts(p_user_id) THEN
    RAISE EXCEPTION 'Troppi tentativi: riprova tra 15 minuti';
  END IF;
  SELECT pin_hash INTO v_hash FROM staff_users WHERE id = p_user_id;
  v_ok := v_hash IS NOT NULL AND v_hash = crypt(trim(coalesce(p_pin, '')), v_hash);
  PERFORM _staff_record_attempt(p_user_id, v_ok);
  RETURN v_ok;
END $$;

-- PIN responsabile: vale il PIN di qualsiasi amministratore.
-- Se non esiste ancora nessun amministratore restituisce NULL (l'app usa il PIN locale di prima configurazione).
CREATE OR REPLACE FUNCTION public.staff_check_admin_pin(p_pin text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_key constant uuid := '00000000-0000-0000-0000-000000000000';
  v_ok boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM staff_users WHERE role = 'admin') THEN
    RETURN NULL;
  END IF;
  IF _staff_too_many_attempts(v_key) THEN
    RAISE EXCEPTION 'Troppi tentativi: riprova tra 15 minuti';
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM staff_users
     WHERE role = 'admin' AND pin_hash = crypt(trim(coalesce(p_pin, '')), pin_hash)
  ) INTO v_ok;
  PERFORM _staff_record_attempt(v_key, v_ok);
  RETURN v_ok;
END $$;

-- Crea o modifica un operatore. Restituisce NULL se ok, altrimenti il messaggio d'errore
-- (niente eccezioni: il tentativo di PIN sbagliato deve restare registrato).
CREATE OR REPLACE FUNCTION public.staff_save(p_admin_pin text, p_id uuid, p_name text, p_role text, p_pin text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_admin_ok boolean;
  v_exists boolean;
BEGIN
  v_admin_ok := staff_check_admin_pin(p_admin_pin);
  IF v_admin_ok IS FALSE THEN RETURN 'PIN amministratore non valido'; END IF;

  IF trim(coalesce(p_name, '')) = '' THEN RETURN 'Nome mancante'; END IF;
  IF p_role NOT IN ('admin', 'waiter', 'kitchen') THEN RETURN 'Ruolo non valido'; END IF;
  IF p_pin IS NOT NULL AND trim(p_pin) !~ '^[0-9]{4,6}$' THEN RETURN 'Il PIN deve avere da 4 a 6 cifre'; END IF;

  SELECT EXISTS (SELECT 1 FROM staff_users WHERE id = p_id) INTO v_exists;
  IF NOT v_exists AND p_pin IS NULL THEN RETURN 'PIN mancante'; END IF;
  -- Il primo operatore creato senza amministratori esistenti deve essere un amministratore
  IF v_admin_ok IS NULL AND p_role <> 'admin' THEN RETURN 'Il primo operatore deve essere un amministratore'; END IF;
  IF v_exists AND p_role <> 'admin'
     AND EXISTS (SELECT 1 FROM staff_users WHERE id = p_id AND role = 'admin')
     AND NOT EXISTS (SELECT 1 FROM staff_users WHERE role = 'admin' AND id <> p_id) THEN
    RETURN 'Deve restare almeno un amministratore';
  END IF;

  INSERT INTO staff_users (id, name, role, pin_hash)
  VALUES (p_id, trim(p_name), p_role, crypt(trim(p_pin), gen_salt('bf', 8)))
  ON CONFLICT (id) DO UPDATE
     SET name = EXCLUDED.name,
         role = EXCLUDED.role,
         pin_hash = CASE WHEN p_pin IS NULL THEN staff_users.pin_hash ELSE EXCLUDED.pin_hash END;
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.staff_delete(p_admin_pin text, p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF staff_check_admin_pin(p_admin_pin) IS NOT TRUE THEN RETURN 'PIN amministratore non valido'; END IF;
  IF EXISTS (SELECT 1 FROM staff_users WHERE id = p_id AND role = 'admin')
     AND NOT EXISTS (SELECT 1 FROM staff_users WHERE role = 'admin' AND id <> p_id) THEN
    RETURN 'Deve restare almeno un amministratore';
  END IF;
  DELETE FROM staff_users WHERE id = p_id;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public._staff_too_many_attempts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._staff_record_attempt(uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.staff_verify_pin(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_check_admin_pin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_save(text, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_delete(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_verify_pin(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_check_admin_pin(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_save(text, uuid, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_delete(text, uuid) TO anon, authenticated;
