-- Aggiunge il codice a barre agli articoli di magazzino, per la scansione rapida
-- (sia per riconoscere un articolo già censito, sia per pre-compilare un nuovo articolo
-- tramite lookup su Open Food Facts).

ALTER TABLE public.magazzino_articoli
    ADD COLUMN codice_a_barre text;

CREATE INDEX magazzino_articoli_codice_a_barre_idx
    ON public.magazzino_articoli (codice_a_barre)
    WHERE codice_a_barre IS NOT NULL;
