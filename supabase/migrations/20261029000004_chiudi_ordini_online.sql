-- La pagina ordini online (/asporto) non è in uso: niente più inserimento di ordini da anonimi.
-- Senza questo permesso chiunque su internet poteva riempire il POS di ordini falsi.
-- Per riattivarla: ripristinare policy e GRANT da 20261029000002_rls_solo_staff.sql (e la pagina dalla cronologia git).
DROP POLICY IF EXISTS public_insert_online ON public.ordini;
REVOKE INSERT ON TABLE public.ordini FROM anon;
