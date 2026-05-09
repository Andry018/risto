ALTER TABLE ingredienti ADD COLUMN IF NOT EXISTS prezzo numeric DEFAULT 0;
ALTER TABLE ingredienti ADD COLUMN IF NOT EXISTS prezzo_rimozione numeric DEFAULT 0;
