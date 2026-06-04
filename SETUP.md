# Werkbonnen – Setup instructies

## Stap 1 — Supabase database aanmaken

1. Ga naar https://supabase.com → maak gratis account
2. Maak een nieuw project aan (bijv. "werkbonnen-jordy")
3. Ga naar **SQL Editor** en plak de inhoud van `supabase-schema.sql` → klik **Run**
4. Ga naar **Project Settings → API** en kopieer:
   - **Project URL** (bijv. `https://xxxx.supabase.co`)
   - **anon / public** key

## Stap 2 — Lokaal testen (optioneel)

```bash
# In de map "Werkbonnen jordy"
npm install
cp .env.local.example .env.local
# Vul je Supabase URL en anon key in in .env.local
npm run dev
# Open http://localhost:3000
```

## Stap 3 — Vercel deploy

1. Maak een GitHub repository aan en push de bestanden:
   ```bash
   git init
   git add .
   git commit -m "eerste versie werkbonnen app"
   git remote add origin https://github.com/jouw-naam/werkbonnen-jordy.git
   git push -u origin main
   ```
2. Ga naar https://vercel.com → **New Project** → koppel je GitHub repo
3. Voeg environment variables toe in Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` = jouw Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = jouw anon key
4. Klik **Deploy** → klaar!

De app is nu bereikbaar op een Vercel URL (bijv. `werkbonnen-jordy.vercel.app`).
Jordy kan deze URL opslaan als snelkoppeling op zijn telefoon via "Toevoegen aan beginscherm".

## Digiboox integratie

1. Open een werkbon → klik **📤 Exporteer naar Digiboox**
2. Er wordt een `.xml` bestand gedownload (UBL 2.1 formaat)
3. Ga naar Digiboox → **Inkopen** of **Facturen** → sleep het XML-bestand in het venster
4. Digiboox leest de gegevens automatisch in → factuur is klaar om te versturen
