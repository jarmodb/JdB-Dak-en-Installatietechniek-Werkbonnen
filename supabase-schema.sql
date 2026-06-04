-- Plak dit in de Supabase SQL Editor en klik Run

create table werkbonnen (
  id uuid default gen_random_uuid() primary key,
  aangemaakt timestamptz default now() not null,
  nummer text not null,
  datum date,
  type text default 'Loodgieter',
  klant_naam text,
  klant_adres text,
  klant_postcode text,
  klant_plaats text,
  klant_tel text,
  omschrijving text,
  uren numeric default 0,
  uurtarief numeric default 0,
  materialen jsonb default '[]'::jsonb,
  arbeid numeric default 0,
  mat_totaal numeric default 0,
  excl_btw numeric default 0,
  btw numeric default 0,
  totaal_incl numeric default 0,
  notities text,
  gefactureerd boolean default false
);

-- Publieke toegang (geen login vereist)
alter table werkbonnen enable row level security;
create policy "publiek lezen" on werkbonnen for select using (true);
create policy "publiek schrijven" on werkbonnen for insert with check (true);
create policy "publiek bijwerken" on werkbonnen for update using (true) with check (true);
create policy "publiek verwijderen" on werkbonnen for delete using (true);
