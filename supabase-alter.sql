-- Voer dit uit in Supabase SQL Editor
alter table werkbonnen add column if not exists werkdagen jsonb default '[]'::jsonb;
