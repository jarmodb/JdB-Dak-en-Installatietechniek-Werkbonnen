-- Voer dit uit in Supabase SQL Editor

-- E-mail velden
alter table klanten add column if not exists email text;
alter table werkbonnen add column if not exists klant_email text;

-- Reistijd en kilometers op werkbon
alter table werkbonnen add column if not exists reistijd numeric default 0;
alter table werkbonnen add column if not exists kilometers numeric default 0;
alter table werkbonnen add column if not exists start_adres text;

-- Meerdere medewerkers per afspraak (array van IDs)
alter table planning add column if not exists medewerkers jsonb default '[]'::jsonb;
-- Migreer bestaande toegewezen_aan naar medewerkers array
update planning
set medewerkers = jsonb_build_array(toegewezen_aan::text)
where toegewezen_aan is not null and (medewerkers = '[]'::jsonb or medewerkers is null);

-- Taken (todo) lijst
create table if not exists todos (
  id uuid default gen_random_uuid() primary key,
  aangemaakt timestamptz default now() not null,
  tekst text not null,
  gedaan boolean default false
);
alter table todos enable row level security;
create policy "publiek" on todos for all using (true) with check (true);
alter publication supabase_realtime add table todos;
