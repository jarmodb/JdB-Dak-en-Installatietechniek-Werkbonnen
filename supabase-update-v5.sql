-- v5: PIN-code voor medewerkers login
ALTER TABLE planning_links ADD COLUMN IF NOT EXISTS pin TEXT;

-- v5b: Medewerkers toewijzen aan werkbonnen
ALTER TABLE werkbonnen ADD COLUMN IF NOT EXISTS medewerkers JSONB DEFAULT '[]'::jsonb;
