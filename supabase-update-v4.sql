-- Voer dit uit in Supabase SQL Editor

-- Prioriteit en medewerker bij taken
alter table todos add column if not exists prioriteit text default 'normaal';
alter table todos add column if not exists medewerker_id uuid references planning_links(id) on delete set null;

-- Meerdere ritten per werkbon
alter table werkbonnen add column if not exists ritten jsonb default '[]'::jsonb;

-- Migreer bestaande reistijd/km naar ritten array
update werkbonnen
set ritten = jsonb_build_array(
  jsonb_build_object(
    'datum', datum::text,
    'startadres', coalesce(start_adres, ''),
    'reistijd', coalesce(reistijd, 0),
    'kilometers', coalesce(kilometers, 0)
  )
)
where (coalesce(reistijd, 0) > 0 or coalesce(kilometers, 0) > 0)
  and (ritten = '[]'::jsonb or ritten is null);
