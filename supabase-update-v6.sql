-- v6: E-mailmeldingen per medewerker
ALTER TABLE planning_links ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE planning_links ADD COLUMN IF NOT EXISTS meldingen BOOLEAN DEFAULT true;
