-- Table for Restaurant Tables
CREATE TABLE IF NOT EXISTS tavoli (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    x INTEGER DEFAULT 10, -- Percentage position X
    y INTEGER DEFAULT 10, -- Percentage position Y
    clienti INTEGER DEFAULT 0,
    status TEXT DEFAULT 'LIBERO', -- 'LIBERO', 'OCCUPATO', 'PRENOTATO'
    shape TEXT DEFAULT 'SQUARE', -- 'SQUARE', 'ROUND'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Realtime for tavoli
ALTER PUBLICATION supabase_realtime ADD TABLE tavoli;

-- Initial data for testing
INSERT INTO tavoli (nome, x, y, clienti, status) VALUES 
('Tavolo 1', 20, 20, 0, 'LIBERO'),
('Tavolo 2', 40, 20, 0, 'LIBERO'),
('Tavolo 3', 60, 20, 0, 'LIBERO'),
('Tavolo 4', 20, 50, 4, 'OCCUPATO'),
('Privé 1', 80, 80, 2, 'OCCUPATO');
