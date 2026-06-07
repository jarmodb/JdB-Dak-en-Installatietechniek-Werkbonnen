-- v12: Apart logo voor offertes (donkere letters, geschikt voor witte achtergrond)
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS offerte_logo_url TEXT;
