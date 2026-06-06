-- v8: Naam veld voor werkbonnen en offertes
ALTER TABLE werkbonnen ADD COLUMN IF NOT EXISTS naam TEXT;
ALTER TABLE offertes ADD COLUMN IF NOT EXISTS naam TEXT;
