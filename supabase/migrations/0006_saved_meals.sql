create table saved_meals (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  name             text not null,
  calories         integer not null,
  protein_g        numeric not null,
  carbs_g          numeric not null,
  fat_g            numeric not null,
  fiber_g          numeric,
  sugar_g          numeric,
  saturated_fat_g  numeric,
  sodium_mg        numeric,
  created_at       timestamptz default now()
);

alter table saved_meals enable row level security;

create policy "user saved meals" on saved_meals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on saved_meals (user_id, created_at desc);
