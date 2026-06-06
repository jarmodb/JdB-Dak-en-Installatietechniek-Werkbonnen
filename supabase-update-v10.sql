-- v10: Algemene voorwaarden URL in instellingen
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS av_url TEXT;
