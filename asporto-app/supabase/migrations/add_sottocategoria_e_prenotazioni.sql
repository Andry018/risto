-- Add sottocategoria column to prodotti
ALTER TABLE prodotti ADD COLUMN IF NOT EXISTS sottocategoria TEXT DEFAULT NULL;

-- Create prenotazioni table
CREATE TABLE IF NOT EXISTS prenotazioni (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    data DATE NOT NULL,
    ora TIME NOT NULL,
    persone INTEGER DEFAULT 1,
    tavolo_id UUID REFERENCES tavoli(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'CONFERMATA' CHECK (status IN ('CONFERMATA', 'ANNULLATA', 'ARRIVATA')),
    note TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for prenotazioni (safe check)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'prenotazioni') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE prenotazioni;
    END IF;
END $$;
