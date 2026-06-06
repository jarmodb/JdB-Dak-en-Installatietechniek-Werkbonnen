-- v5: PIN-code voor medewerkers login
ALTER TABLE planning_links ADD COLUMN IF NOT EXISTS pin TEXT;
