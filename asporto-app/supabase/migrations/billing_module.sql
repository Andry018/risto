-- Billing & Export Module
-- Run this in your Supabase SQL editor (Studio -> SQL Editor)

-- 1. Create storage bucket for invoices
-- If this fails, create the bucket manually from Supabase Studio -> Storage -> Create bucket
-- Name: archivio_documenti, Public: true
insert into storage.buckets (id, name, public) values ('archivio_documenti', 'archivio_documenti', true)
on conflict (id) do nothing;

-- 2. Create documenti_emessi table
create table if not exists documenti_emessi (
  id uuid primary key default gen_random_uuid(),
  doc_number text not null,
  customer_name text not null default '',
  piva_cf text not null default '',
  customer_address text not null default '',
  company_name text not null default '',
  codice_univoco text not null default '',
  description text not null,
  total numeric(10,2) not null,
  payment_method text not null default 'contanti' check (payment_method in ('contanti', 'carta')),
  doc_date date not null default current_date,
  file_url text not null default '',
  mode text not null check (mode in ('linked', 'manual')),
  order_id text,
  created_at timestamptz not null default now()
);

-- Add column if table already existed without it
alter table documenti_emessi add column if not exists codice_univoco text not null default '';

-- 3. Enable RLS & policies
alter table documenti_emessi enable row level security;

create policy "Anyone can select documenti_emessi"
  on documenti_emessi for select using (true);
create policy "Anyone can insert documenti_emessi"
  on documenti_emessi for insert with check (true);
create policy "Anyone can update documenti_emessi"
  on documenti_emessi for update using (true);
create policy "Anyone can delete documenti_emessi"
  on documenti_emessi for delete using (true);

-- 4. Auto-increment sequence for document numbers
create sequence if not exists doc_number_seq start with 1 increment by 1;

-- 5. Function to generate next doc number (e.g., Doc-2026-001)
create or replace function next_doc_number()
returns text
language sql
as $$
  select 'Doc-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('doc_number_seq')::text, 3, '0');
$$;

-- 6. Grant permissions to anon/authenticated roles
grant all on documenti_emessi to anon, authenticated;
grant usage on sequence doc_number_seq to anon, authenticated;
grant execute on function next_doc_number to anon, authenticated;

-- 7. Storage bucket policies (so anon key can upload/read files)
create policy "Anyone can view invoices"
  on storage.objects for select using (bucket_id = 'archivio_documenti');
create policy "Anyone can upload invoices"
  on storage.objects for insert with check (bucket_id = 'archivio_documenti');
create policy "Anyone can update invoices"
  on storage.objects for update using (bucket_id = 'archivio_documenti');
create policy "Anyone can delete invoices"
  on storage.objects for delete using (bucket_id = 'archivio_documenti');
