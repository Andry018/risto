-- Schema minimale per il menu pubblico (progetto Supabase Cloud separato da quello del locale).
-- Contiene SOLO i dati del menu da mostrare online — nessun ordine, tavolo o dato sensibile.

create table public.prodotti_pubblico (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  prezzo numeric(10,2) not null,
  categoria text not null,
  sottocategoria text,
  ingredienti text[] default '{}',
  allergeni text[] default '{}',
  disponibile boolean default true,
  updated_at timestamptz default now()
);

alter table public.prodotti_pubblico enable row level security;

-- Chiunque (anche anonimo) può leggere il menu: è pubblico per definizione.
create policy "select_pubblico"
  on public.prodotti_pubblico for select
  using (true);

-- Nessuna policy di INSERT/UPDATE/DELETE per anon/authenticated: la scrittura avviene
-- solo dall'endpoint serverless /api/publish-menu, che usa la service_role key
-- (che salta la RLS) e non è mai esposta al browser.

grant select on public.prodotti_pubblico to anon, authenticated;
