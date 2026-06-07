-- v14: Korting op offertes (één korting voor de hele offerte, percentage of vast bedrag)
-- Wordt toegepast op het subtotaal vóórdat de BTW wordt berekend.
-- Blijft leeg ('korting_waarde' = NULL) tenzij er expliciet iets is ingevuld —
-- dan verschijnt de kortingsregel ook niet op de offerte/PDF.

ALTER TABLE offertes ADD COLUMN IF NOT EXISTS korting_type TEXT DEFAULT 'percentage';
ALTER TABLE offertes ADD COLUMN IF NOT EXISTS korting_waarde NUMERIC;
