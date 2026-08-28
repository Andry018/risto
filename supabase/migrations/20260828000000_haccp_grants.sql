-- Fix: aggiungi GRANT mancanti per tabelle HACCP
-- haccp_fornitori, haccp_prodotti_fornitori, haccp_etichette non avevano grant per anon/authenticated

GRANT ALL ON TABLE public.haccp_fornitori TO anon;
GRANT ALL ON TABLE public.haccp_fornitori TO authenticated;
GRANT ALL ON TABLE public.haccp_fornitori TO service_role;
GRANT ALL ON TABLE public.haccp_fornitori TO authenticator;

GRANT ALL ON TABLE public.haccp_prodotti_fornitori TO anon;
GRANT ALL ON TABLE public.haccp_prodotti_fornitori TO authenticated;
GRANT ALL ON TABLE public.haccp_prodotti_fornitori TO service_role;
GRANT ALL ON TABLE public.haccp_prodotti_fornitori TO authenticator;

GRANT ALL ON TABLE public.haccp_etichette TO anon;
GRANT ALL ON TABLE public.haccp_etichette TO authenticated;
GRANT ALL ON TABLE public.haccp_etichette TO service_role;
GRANT ALL ON TABLE public.haccp_etichette TO authenticator;

-- haccp_prodotti aveva solo grant per anon, aggiungi gli altri ruoli
GRANT ALL ON TABLE public.haccp_prodotti TO authenticated;
GRANT ALL ON TABLE public.haccp_prodotti TO service_role;
GRANT ALL ON TABLE public.haccp_prodotti TO authenticator;

-- RLS + policy per haccp_etichette (mancava del tutto)
ALTER TABLE public.haccp_etichette ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON public.haccp_etichette USING (true) WITH CHECK (true);
