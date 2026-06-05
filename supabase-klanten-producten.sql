-- Voer dit uit in Supabase SQL Editor

create table klanten (
  id uuid default gen_random_uuid() primary key,
  aangemaakt timestamptz default now() not null,
  naam text not null,
  adres text,
  postcode text,
  plaats text,
  telefoon text
);

create table producten (
  id uuid default gen_random_uuid() primary key,
  aangemaakt timestamptz default now() not null,
  naam text not null,
  prijs numeric default 0,
  eenheid text default 'stuk'
);

-- Publieke toegang
alter table klanten enable row level security;
create policy "publiek" on klanten for all using (true) with check (true);

alter table producten enable row level security;
create policy "publiek" on producten for all using (true) with check (true);

-- Real-time sync
alter publication supabase_realtime add table klanten;
alter publication supabase_realtime add table producten;
