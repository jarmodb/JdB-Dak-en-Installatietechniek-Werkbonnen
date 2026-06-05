-- Voer dit uit in Supabase SQL Editor

create table planning (
  id uuid default gen_random_uuid() primary key,
  aangemaakt timestamptz default now() not null,
  datum date not null,
  tijdstip_van time,
  tijdstip_tot time,
  titel text not null,
  omschrijving text,
  klant_naam text,
  klant_adres text,
  klant_postcode text,
  klant_plaats text,
  werkbon_id uuid references werkbonnen(id) on delete set null,
  kleur text default '#C9A227'
);

create table planning_links (
  id uuid default gen_random_uuid() primary key,
  naam text not null,
  token text unique not null,
  aangemaakt timestamptz default now() not null
);

-- Publieke toegang
alter table planning enable row level security;
create policy "publiek" on planning for all using (true) with check (true);

alter table planning_links enable row level security;
create policy "publiek" on planning_links for all using (true) with check (true);

-- Real-time sync
alter publication supabase_realtime add table planning;
alter publication supabase_realtime add table planning_links;
