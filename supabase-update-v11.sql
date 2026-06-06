-- v11: Prefix configuratie voor werkbon- en offertenummering
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS wb_prefix TEXT DEFAULT 'WB';
ALTER TABLE instellingen ADD COLUMN IF NOT EXISTS offerte_prefix TEXT DEFAULT 'OFN';
