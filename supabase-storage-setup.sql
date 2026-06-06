-- Supabase Storage setup voor werkbon foto's
-- Voer dit uit in de Supabase SQL editor

-- Maak een publieke bucket aan via het Supabase dashboard:
-- Storage → New bucket → naam: "werkbon-fotos" → Public: aan

-- Daarna deze policies uitvoeren:

INSERT INTO storage.buckets (id, name, public)
VALUES ('werkbon-fotos', 'werkbon-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Iedereen mag uploaden (medewerkers hebben geen eigen login)
CREATE POLICY "Allow uploads werkbon-fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'werkbon-fotos');

-- Iedereen mag lezen (publieke bucket)
CREATE POLICY "Allow reads werkbon-fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'werkbon-fotos');

-- Iedereen mag verwijderen (voor beheer)
CREATE POLICY "Allow deletes werkbon-fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'werkbon-fotos');
