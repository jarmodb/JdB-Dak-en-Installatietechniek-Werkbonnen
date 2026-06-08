# Changelog – JdB Werkbonnen

Alle wijzigingen per versie worden hier bijgehouden.

---

## v1.5 – 8 juni 2026

### Nieuw
- **Statusfases voor werkbonnen**: in plaats van alleen 'Open'/'Gefactureerd' heeft een werkbon nu vier fases: **Open → In uitvoering → Afgerond → Gefactureerd**. De status is te wijzigen via een dropdown op de detailpagina en wordt overal als gekleurd label getoond (overzicht, detail, planning, medewerkerlink).

### Verbeterd
- Bestaande werkbonnen worden automatisch gemigreerd: bonnen die al als 'gefactureerd' waren gemarkeerd krijgen die status, de rest start als 'Open'.

---

## v1.4 – 6 juni 2026

### Nieuw
- **Medewerker login (PIN)**: elke medewerker logt in via hun persoonlijke link met een 4-cijferige PIN.
- **Werkbonnen voor medewerkers**: na inloggen kunnen medewerkers werkbonnen invullen. Ze zien alleen hun toegewezen werkbonnen.
- **Ritten in medewerkerlink**: medewerkers kunnen ritten toevoegen met automatische km-berekening. Hun naam staat automatisch op de rit.
- **Foto's in medewerkerlink**: foto's uploaden via Supabase Storage (geen Microsoft login nodig).
- **Producten in medewerkerlink**: dropdown met productenlijst bij materialen — naam en eenheid zichtbaar, prijzen niet.
- **Navigatie voor medewerkers**: tabbladen Planning, Taken en Werkbonnen in de persoonlijke link.
- **Teller op Taken-tab**: rood bolletje toont het aantal openstaande taken.

### Verbeterd
- Medewerker wordt automatisch ingevuld bij werkdagen én ritten die zij toevoegen.
- Medewerkersbeheer toont of er een PIN is ingesteld.
- Medewerkers zonder PIN krijgen direct toegang (backwards compat.).

---

## v1.3 – 6 juni 2026

### Nieuw
- **Medewerker per werkdag**: bij elke gewerkte dag kun je aangeven wie het werk heeft gedaan (gekleurd bolletje met initiaal). Klikken wisselt door de medewerkers. De naam staat ook op de afdruk.
- **OneDrive PDF-opslag**: bij elke opgeslagen of bijgewerkte werkbon wordt automatisch een PDF opgeslagen in OneDrive (`Werkbonnen / WB-xxx - Klantnaam /`). De vorige PDF wordt overschreven.
- **Foto's in juiste map**: foto's worden opgeslagen in dezelfde map als de PDF van die werkbon.
- **Taken afvinken in personeelslink**: medewerkers kunnen hun eigen openstaande taken afvinken via hun persoonlijke planningslink.

### Verbeterd
- Werkbon actiebalk: **Bewerken** staat nu als hoofdknop links; PDF / Afdrukken kleiner rechts.
- "Exporteer naar Digiboox" knop verwijderd.

---

## v1.2 – 5 juni 2026

### Nieuw
- **Reisritten**: meerdere reisritten per werkbon (voor meerdere bezoeken). Kilometers en reistijd worden automatisch berekend via routeplanner. Navigatieknop per rit.
- **Taken tabblad**: taken aanmaken met prioriteit (Hoog / Normaal / Laag) en toewijzen aan medewerkers. Prioriteit direct aanpassen door op het label te klikken.
- **Meerdere medewerkers per afspraak**: meerdere personen koppelen aan één afspraak in de planning.
- **Weeknummers** zichtbaar in het maandoverzicht.
- **Mailadres** invoerveld bij werkbonnen en klanten.
- **Werkbon koppelen aan afspraak**: adres en omschrijving worden automatisch overgenomen.
- **Tabnaam browser**: persoonlijke planningslink toont de naam van de medewerker als tabbladtitel.
- **Todo's in personeelslink**: openstaande taken zichtbaar onderaan de persoonlijke planningslink.
- **PWA Android-icoon**: app is installeerbaar op Android met eigen icoon.

### Verbeterd
- Mailadres wordt automatisch ingevuld als je een klant koppelt aan een werkbon.
- Adresveld bij reisritten is nu goed bruikbaar op de telefoon (volle breedte).
- Navigatieknop in personeelslink zichtbaar.

### Opgelost
- Taalfout "afspraaken" in dag- en weekplanning.
- Straat en huisnummer werden niet correct gesplitst bij klant overnemen.
- Postcode automatisch invullen werkte niet correct in klantbestand.

---

## v1.1 – april 2026

### Nieuw
- **Planning module**: week-, maand- en dagweergave met medewerkerfilter.
- **Persoonlijke planningslinks**: geheime link per medewerker met alleen-lezen weergave.
- **Klanten**: e-mailadres toegevoegd; adres wordt correct gesplitst in straat + huisnummer.
- Afspraken tonen kort overzicht in maandweergave (niet alleen bolletjes).

---

## v1.0 – maart 2026

### Eerste versie
- Werkbonnen aanmaken, bewerken, verwijderen.
- Klanten- en productenbestand.
- Reistijd en kilometers per werkbon.
- Materialen en uren registreren.
- PDF afdrukken.
- Factuurstatus bijhouden.
- Real-time synchronisatie tussen apparaten (Supabase).
- Installeerbaar als app op telefoon (PWA).
