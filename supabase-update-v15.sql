-- v15: Statusfases voor werkbonnen (i.p.v. alleen 'gefactureerd' aan/uit)
-- Nieuwe fases: open -> in_uitvoering -> afgerond -> gefactureerd
-- Bestaande bonnen worden automatisch gemigreerd op basis van het oude 'gefactureerd' veld.
-- Het oude 'gefactureerd' veld blijft staan (ongebruikt) zodat er niets verloren gaat.

ALTER TABLE werkbonnen ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';

UPDATE werkbonnen SET status = 'gefactureerd' WHERE gefactureerd = true AND (status IS NULL OR status = 'open');
UPDATE werkbonnen SET status = 'open' WHERE status IS NULL;
