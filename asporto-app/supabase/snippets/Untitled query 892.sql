-- Create Ingredients Table
CREATE TABLE IF NOT EXISTS ingredienti (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT UNIQUE NOT NULL,
    disponibile BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add ingredienti array to prodotti if not exists
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='prodotti' AND column_name='ingredienti') THEN
        ALTER TABLE prodotti ADD COLUMN ingredienti TEXT[] DEFAULT '{}';
    END IF;
END $$;

-- Enable Realtime for ingredienti
-- Note: This might fail if the table is already in the publication, so we use a safe approach
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'ingredienti') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE ingredienti;
    END IF;
END $$;

-- Insert some default ingredients based on products
INSERT INTO ingredienti (nome) VALUES 
('Mozzarella'),
('Pomodoro'),
('Salsiccia'),
('Friarielli'),
('Funghi'),
('Carciofi'),
('Prosciutto Cotto'),
('Prosciutto Crudo'),
('Wurstel'),
('Olive Nere'),
('Olive Verdi'),
('Patatine'),
('Cipolla'),
('Zucchine'),
('Bocconcino'),
('Pomodorini'),
('Lattuga Iceberg'),
('Mais'),
('Speck'),
('Peperoni'),
('Melanzane'),
('Edam'),
('Parmigiano'),
('Emmenthal'),
('Patate Lesse'),
('Porcini'),
('Salmone Affumicato'),
('Porchetta'),
('Auricchio Piccante'),
('Scaglie di Parmigiano'),
('Rucola'),
('Bresaola'),
('Pancetta'),
('Provola Affumicata'),
('Noci'),
('Pancetta Piccante'),
('Patate al forno'),
('Aglio'),
('Origano'),
('Caprino'),
('Acciughe'),
('Mozzarella di Bufala'),
('Salame Dolce'),
('Salame Piccante'),
('Parmigiana'),
('Broccoli'),
('Nutella'),
('Tonno'),
('Gorgonzola')
ON CONFLICT (nome) DO NOTHING;
