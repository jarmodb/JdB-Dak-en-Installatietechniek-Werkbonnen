-- Voer dit uit in Supabase SQL Editor (aanvulling op supabase-planning.sql)

-- Koppel afspraken aan medewerkers
alter table planning add column if not exists toegewezen_aan uuid references planning_links(id) on delete set null;

-- Zichtbaar voor alle medewerkers (algemene afspraken)
alter table planning add column if not exists voor_iedereen boolean default false;

-- Kleur per medewerker
alter table planning_links add column if not exists kleur text default '#C9A227';
