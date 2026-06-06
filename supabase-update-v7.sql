-- v7: Offertes module
CREATE TABLE IF NOT EXISTS offertes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nummer TEXT,
  status TEXT DEFAULT 'concept',
  aangemaakt TIMESTAMPTZ DEFAULT now(),
  klant_naam TEXT,
  klant_adres TEXT,
  klant_postcode TEXT,
  klant_plaats TEXT,
  klant_email TEXT,
  datum DATE DEFAULT CURRENT_DATE,
  geldig_tot DATE,
  tekst TEXT,
  materialen JSONB DEFAULT '[]'::jsonb,
  materialen_tonen BOOLEAN DEFAULT true,
  uren NUMERIC DEFAULT 0,
  uurtarief NUMERIC DEFAULT 65,
  btw_percentage NUMERIC DEFAULT 21,
  notities TEXT
);

CREATE TABLE IF NOT EXISTS offerte_sjablonen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  naam TEXT NOT NULL,
  werktype TEXT,
  tekst TEXT,
  aangemaakt TIMESTAMPTZ DEFAULT now()
);

-- RLS uitschakelen (zelfde aanpak als andere tabellen)
ALTER TABLE offertes ENABLE ROW LEVEL SECURITY;
ALTER TABLE offerte_sjablonen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alles toegestaan offertes" ON offertes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Alles toegestaan sjablonen" ON offerte_sjablonen FOR ALL USING (true) WITH CHECK (true);
