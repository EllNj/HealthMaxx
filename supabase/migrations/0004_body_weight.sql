create table body_weight_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  weight_kg    numeric not null,
  logged_date  date not null default current_date,
  notes        text,
  created_at   timestamptz default now(),
  unique (user_id, logged_date)
);

alter table body_weight_logs enable row level security;

create policy "user weight logs" on body_weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index on body_weight_logs (user_id, logged_date desc);
