-- Add columns to prodotti table
ALTER TABLE prodotti 
ADD COLUMN IF NOT EXISTS immagine TEXT,
ADD COLUMN IF NOT EXISTS allergeni TEXT[] DEFAULT '{}';

-- Add column to tavoli table
ALTER TABLE tavoli 
ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';

-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product_images', 'product_images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to product_images bucket
CREATE POLICY "Product Images Public Read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product_images');

-- Allow authenticated upload to product_images bucket
CREATE POLICY "Product Images Upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'product_images');

-- Allow authenticated update/delete of own files
CREATE POLICY "Product Images Write" ON storage.objects
  FOR UPDATE USING (bucket_id = 'product_images')
  WITH CHECK (bucket_id = 'product_images');

CREATE POLICY "Product Images Delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'product_images');
