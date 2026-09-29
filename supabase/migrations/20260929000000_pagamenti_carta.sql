--
-- Registro pagamenti carta (terminale PAX via ECR agent).
-- Una riga per ogni tentativo di pagamento (anche rifiutato / esito sconosciuto),
-- con i dati per riconciliare con il rapporto del POS e per lo storno.
--

CREATE TABLE public.pagamenti_carta (
    id uuid DEFAULT gen_random_uuid() NOT NULL,       -- generato dal client (idempotenza)
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    riferimento text DEFAULT ''::text NOT NULL,       -- tavolo / "POS"
    quota text,                                       -- "2/3" se conto diviso
    importo numeric(10,2) NOT NULL,
    esito text NOT NULL,
    stan text,                                        -- numero transazione del terminale (serve per lo storno)
    auth_code text,
    tx_id text,                                       -- id interno ECR agent
    recuperato boolean DEFAULT false NOT NULL,        -- esito ricostruito con il comando 'G'
    errore text,
    operatore text DEFAULT ''::text NOT NULL,
    stornato_at timestamp with time zone,
    storno_tipo text,
    storno_operatore text,
    storno_note text,
    CONSTRAINT pagamenti_carta_esito_check CHECK ((esito = ANY (ARRAY['APPROVATO'::text, 'RIFIUTATO'::text, 'NON_ESEGUITO'::text, 'SCONOSCIUTO'::text]))),
    CONSTRAINT pagamenti_carta_storno_tipo_check CHECK ((storno_tipo IS NULL OR storno_tipo = ANY (ARRAY['ECR'::text, 'MANUALE'::text])))
);

ALTER TABLE ONLY public.pagamenti_carta
    ADD CONSTRAINT pagamenti_carta_pkey PRIMARY KEY (id);

CREATE INDEX pagamenti_carta_created_at_idx ON public.pagamenti_carta (created_at DESC);

ALTER TABLE public.pagamenti_carta ENABLE ROW LEVEL SECURITY;
CREATE POLICY allow_all ON public.pagamenti_carta USING (true) WITH CHECK (true);
GRANT ALL ON TABLE public.pagamenti_carta TO anon, authenticated, service_role, authenticator;
