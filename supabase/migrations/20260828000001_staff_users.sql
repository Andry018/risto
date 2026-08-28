-- Tabella operatori staff (per sincronizzazione cross-device)
-- Sostituisce il localStorage per permettere agli operatori di accedere da qualsiasi dispositivo

CREATE TABLE public.staff_users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  pin text NOT NULL,
  role text NOT NULL DEFAULT 'waiter' CHECK (role IN ('admin', 'waiter', 'kitchen')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.staff_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON public.staff_users USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public.staff_users TO anon;
GRANT ALL ON TABLE public.staff_users TO authenticated;
GRANT ALL ON TABLE public.staff_users TO service_role;
GRANT ALL ON TABLE public.staff_users TO authenticator;
