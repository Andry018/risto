--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 15.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA IF NOT EXISTS public;



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: next_doc_number(); Type: FUNCTION; Schema: public; Owner: supabase_admin
--

CREATE FUNCTION public.next_doc_number() RETURNS text
    LANGUAGE sql
    AS $$

  select 'Doc-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('doc_number_seq')::text, 3, '0');

$$;



--
-- Name: doc_number_seq; Type: SEQUENCE; Schema: public; Owner: supabase_admin
--

CREATE SEQUENCE public.doc_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: documenti_emessi; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.documenti_emessi (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    doc_number text NOT NULL,
    customer_name text DEFAULT ''::text NOT NULL,
    piva_cf text DEFAULT ''::text NOT NULL,
    customer_address text DEFAULT ''::text NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    description text NOT NULL,
    total numeric(10,2) NOT NULL,
    payment_method text DEFAULT 'contanti'::text NOT NULL,
    doc_date date DEFAULT CURRENT_DATE NOT NULL,
    file_url text DEFAULT ''::text NOT NULL,
    mode text NOT NULL,
    order_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    codice_univoco text DEFAULT ''::text NOT NULL,
    CONSTRAINT documenti_emessi_mode_check CHECK ((mode = ANY (ARRAY['linked'::text, 'manual'::text]))),
    CONSTRAINT documenti_emessi_payment_method_check CHECK ((payment_method = ANY (ARRAY['contanti'::text, 'carta'::text])))
);



--
-- Name: haccp_etichette; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.haccp_etichette (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lotto text NOT NULL,
    prodotto_id uuid,
    data_preparazione timestamp with time zone,
    data_scadenza date,
    created_at timestamp with time zone DEFAULT now()
);



--
-- Name: haccp_fornitori; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.haccp_fornitori (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    partita_iva text,
    telefono text,
    indirizzo text,
    note text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: haccp_prodotti; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.haccp_prodotti (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome_prodotto text NOT NULL,
    ingredienti text,
    allergeni text,
    giorni_scadenza integer DEFAULT 5 NOT NULL,
    conservazione text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);



--
-- Name: haccp_prodotti_fornitori; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.haccp_prodotti_fornitori (
    prodotto_id uuid NOT NULL,
    fornitore_id uuid NOT NULL
);



--
-- Name: ingredienti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ingredienti (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    disponibile boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    prezzo_rimozione numeric DEFAULT 0,
    prezzo numeric DEFAULT 0
);



--
-- Name: ordini; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.ordini (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    nome_cliente text NOT NULL,
    orario_ritiro time without time zone NOT NULL,
    totale numeric(10,2) NOT NULL,
    status text DEFAULT 'IN_ATTESA'::text NOT NULL,
    carrello jsonb NOT NULL,
    sconto_tipo text,
    sconto_valore numeric(10,2) DEFAULT NULL::numeric,
    CONSTRAINT ordini_status_check CHECK ((status = ANY (ARRAY['IN_ATTESA'::text, 'COMPLETATO'::text])))
);



--
-- Name: prenotazioni; Type: TABLE; Schema: public; Owner: supabase_admin
--

CREATE TABLE public.prenotazioni (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    data date NOT NULL,
    ora time without time zone NOT NULL,
    persone integer DEFAULT 1,
    tavolo_id uuid,
    status text DEFAULT 'CONFERMATA'::text,
    note text DEFAULT ''::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT prenotazioni_status_check CHECK ((status = ANY (ARRAY['CONFERMATA'::text, 'ANNULLATA'::text, 'ARRIVATA'::text])))
);



--
-- Name: prodotti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.prodotti (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    prezzo numeric(10,2) NOT NULL,
    categoria text NOT NULL,
    disponibile boolean DEFAULT true,
    ingredienti text[] DEFAULT '{}'::text[],
    sottocategoria text,
    immagine text,
    allergeni text[] DEFAULT '{}'::text[]
);



--
-- Name: tavoli; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tavoli (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    nome text NOT NULL,
    x integer DEFAULT 10,
    y integer DEFAULT 10,
    clienti integer DEFAULT 0,
    status text DEFAULT 'LIBERO'::text,
    shape text DEFAULT 'SQUARE'::text,
    sala text DEFAULT 'SALA 1'::text,
    created_at timestamp with time zone DEFAULT now(),
    note text DEFAULT ''::text
);



--
-- Name: documenti_emessi documenti_emessi_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.documenti_emessi
    ADD CONSTRAINT documenti_emessi_pkey PRIMARY KEY (id);


--
-- Name: haccp_etichette haccp_etichette_lotto_key; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_etichette
    ADD CONSTRAINT haccp_etichette_lotto_key UNIQUE (lotto);


--
-- Name: haccp_etichette haccp_etichette_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_etichette
    ADD CONSTRAINT haccp_etichette_pkey PRIMARY KEY (id);


--
-- Name: haccp_fornitori haccp_fornitori_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_fornitori
    ADD CONSTRAINT haccp_fornitori_pkey PRIMARY KEY (id);


--
-- Name: haccp_prodotti_fornitori haccp_prodotti_fornitori_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_prodotti_fornitori
    ADD CONSTRAINT haccp_prodotti_fornitori_pkey PRIMARY KEY (prodotto_id, fornitore_id);


--
-- Name: haccp_prodotti haccp_prodotti_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_prodotti
    ADD CONSTRAINT haccp_prodotti_pkey PRIMARY KEY (id);


--
-- Name: ingredienti ingredienti_nome_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ingredienti
    ADD CONSTRAINT ingredienti_nome_key UNIQUE (nome);


--
-- Name: ingredienti ingredienti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ingredienti
    ADD CONSTRAINT ingredienti_pkey PRIMARY KEY (id);


--
-- Name: ordini ordini_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.ordini
    ADD CONSTRAINT ordini_pkey PRIMARY KEY (id);


--
-- Name: prenotazioni prenotazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.prenotazioni
    ADD CONSTRAINT prenotazioni_pkey PRIMARY KEY (id);


--
-- Name: prodotti prodotti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.prodotti
    ADD CONSTRAINT prodotti_pkey PRIMARY KEY (id);


--
-- Name: tavoli tavoli_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tavoli
    ADD CONSTRAINT tavoli_pkey PRIMARY KEY (id);


--
-- Name: haccp_etichette haccp_etichette_prodotto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_etichette
    ADD CONSTRAINT haccp_etichette_prodotto_id_fkey FOREIGN KEY (prodotto_id) REFERENCES public.haccp_prodotti(id);


--
-- Name: haccp_prodotti_fornitori haccp_prodotti_fornitori_fornitore_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_prodotti_fornitori
    ADD CONSTRAINT haccp_prodotti_fornitori_fornitore_id_fkey FOREIGN KEY (fornitore_id) REFERENCES public.haccp_fornitori(id) ON DELETE CASCADE;


--
-- Name: haccp_prodotti_fornitori haccp_prodotti_fornitori_prodotto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.haccp_prodotti_fornitori
    ADD CONSTRAINT haccp_prodotti_fornitori_prodotto_id_fkey FOREIGN KEY (prodotto_id) REFERENCES public.haccp_prodotti(id) ON DELETE CASCADE;


--
-- Name: prenotazioni prenotazioni_tavolo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: supabase_admin
--

ALTER TABLE ONLY public.prenotazioni
    ADD CONSTRAINT prenotazioni_tavolo_id_fkey FOREIGN KEY (tavolo_id) REFERENCES public.tavoli(id) ON DELETE SET NULL;


--
-- Name: documenti_emessi Anyone can delete documenti_emessi; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Anyone can delete documenti_emessi" ON public.documenti_emessi FOR DELETE USING (true);


--
-- Name: documenti_emessi Anyone can insert documenti_emessi; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Anyone can insert documenti_emessi" ON public.documenti_emessi FOR INSERT WITH CHECK (true);


--
-- Name: documenti_emessi Anyone can select documenti_emessi; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Anyone can select documenti_emessi" ON public.documenti_emessi FOR SELECT USING (true);


--
-- Name: documenti_emessi Anyone can update documenti_emessi; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY "Anyone can update documenti_emessi" ON public.documenti_emessi FOR UPDATE USING (true);


--
-- Name: haccp_fornitori allow_all; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_all ON public.haccp_fornitori USING (true) WITH CHECK (true);


--
-- Name: haccp_prodotti_fornitori allow_all; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_all ON public.haccp_prodotti_fornitori USING (true) WITH CHECK (true);


--
-- Name: haccp_prodotti allow_delete; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_delete ON public.haccp_prodotti FOR DELETE USING (true);


--
-- Name: haccp_prodotti allow_insert; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_insert ON public.haccp_prodotti FOR INSERT WITH CHECK (true);


--
-- Name: haccp_prodotti allow_select; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_select ON public.haccp_prodotti FOR SELECT USING (true);


--
-- Name: haccp_prodotti allow_update; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY allow_update ON public.haccp_prodotti FOR UPDATE USING (true) WITH CHECK (true);


--
-- Name: prenotazioni anon_all_prenotazioni; Type: POLICY; Schema: public; Owner: supabase_admin
--

CREATE POLICY anon_all_prenotazioni ON public.prenotazioni TO anon USING (true) WITH CHECK (true);


--
-- Name: documenti_emessi; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.documenti_emessi ENABLE ROW LEVEL SECURITY;

--
-- Name: haccp_fornitori; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.haccp_fornitori ENABLE ROW LEVEL SECURITY;

--
-- Name: haccp_prodotti; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.haccp_prodotti ENABLE ROW LEVEL SECURITY;

--
-- Name: haccp_prodotti_fornitori; Type: ROW SECURITY; Schema: public; Owner: supabase_admin
--

ALTER TABLE public.haccp_prodotti_fornitori ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticator;


--
-- Name: FUNCTION next_doc_number(); Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON FUNCTION public.next_doc_number() TO anon;
GRANT ALL ON FUNCTION public.next_doc_number() TO authenticated;


--
-- Name: SEQUENCE doc_number_seq; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT USAGE ON SEQUENCE public.doc_number_seq TO anon;
GRANT USAGE ON SEQUENCE public.doc_number_seq TO authenticated;


--
-- Name: TABLE documenti_emessi; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.documenti_emessi TO anon;
GRANT ALL ON TABLE public.documenti_emessi TO authenticated;


--
-- Name: TABLE haccp_prodotti; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.haccp_prodotti TO anon;


--
-- Name: TABLE ingredienti; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ingredienti TO anon;
GRANT ALL ON TABLE public.ingredienti TO authenticated;
GRANT ALL ON TABLE public.ingredienti TO service_role;
GRANT ALL ON TABLE public.ingredienti TO authenticator;


--
-- Name: TABLE ordini; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.ordini TO anon;
GRANT ALL ON TABLE public.ordini TO authenticated;
GRANT ALL ON TABLE public.ordini TO service_role;
GRANT ALL ON TABLE public.ordini TO authenticator;


--
-- Name: TABLE prenotazioni; Type: ACL; Schema: public; Owner: supabase_admin
--

GRANT ALL ON TABLE public.prenotazioni TO authenticator;
GRANT ALL ON TABLE public.prenotazioni TO anon;


--
-- Name: TABLE prodotti; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.prodotti TO anon;
GRANT ALL ON TABLE public.prodotti TO authenticated;
GRANT ALL ON TABLE public.prodotti TO service_role;
GRANT ALL ON TABLE public.prodotti TO authenticator;


--
-- Name: TABLE tavoli; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.tavoli TO anon;
GRANT ALL ON TABLE public.tavoli TO authenticated;
GRANT ALL ON TABLE public.tavoli TO service_role;
GRANT ALL ON TABLE public.tavoli TO authenticator;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO service_role;


--
-- PostgreSQL database dump complete
--

