-- v12: Apart logo voor offertes (donkere letters, geschikt voor witte achtergrond)
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS offerte_logo_url TEXT;

-- Naam die onderaan offertes komt te staan bij "Met vriendelijke groet,"
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS ondertekenaar TEXT;
