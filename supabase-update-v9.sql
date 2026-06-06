-- v9: Bedrijfsinstellingen (singleton)
CREATE TABLE IF NOT EXISTS instellingen (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  bedrijfsnaam TEXT DEFAULT 'JdB Dak- en Installatietechniek',
  adres TEXT,
  postcode TEXT,
  plaats TEXT,
  telefoon TEXT,
  email TEXT,
  website TEXT,
  btw_nummer TEXT,
  kvk_nummer TEXT,
  iban TEXT,
  logo_url TEXT
);
ALTER TABLE instellingen ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Alles toegestaan instellingen" ON instellingen FOR ALL USING (true) WITH CHECK (true);
-- Standaard rij aanmaken
INSERT INTO instellingen (id) VALUES ('singleton') ON CONFLICT (id) DO NOTHING;
