-- v13: Meerdere uren-posten per offerte (zodat werkzaamheden uitgesplitst kunnen
-- worden, bijv. "Voorbereiding: 4 uur", "Uitvoering: 12 uur", "Oplevering: 2 uur")
ALTER TABLE offertes ADD COLUMN IF NOT EXISTS arbeidsposten JSONB DEFAULT '[]'::jsonb;

-- Bestaande offertes met een ingevuld los `uren`-veld migreren naar één post,
-- zodat ze niet leeg lijken bij het openen
UPDATE offertes
SET arbeidsposten = jsonb_build_array(jsonb_build_object('omschrijving', 'Werkzaamheden', 'uren', uren))
WHERE (arbeidsposten IS NULL OR arbeidsposten = '[]'::jsonb)
  AND uren IS NOT NULL AND uren > 0;
