ALTER TABLE prodotti ADD COLUMN IF NOT EXISTS traduzioni JSONB DEFAULT '{}'::jsonb;
