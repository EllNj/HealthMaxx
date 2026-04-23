-- HealthMaxx initial schema
-- Run this in the Supabase SQL editor (one-time)

-- ============================================================
-- profiles: one row per user
-- ============================================================
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  height_cm          numeric,
  weight_kg          numeric,
  body_fat_pct       numeric,
  skeletal_muscle_kg numeric,
  tee_kcal           integer,
  calorie_goal       integer,
  protein_goal_g     integer,
  carbs_goal_g       integer,
  fat_goal_g         integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_self_select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_self_insert" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_self_update" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ============================================================
-- exercises: catalog (system + user custom)
-- ============================================================
create table public.exercises (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  muscle_group text,
  equipment    text,
  display_unit text not null default 'kg' check (display_unit in ('kg', 'lbs')),
  is_system    boolean not null default false,
  user_id      uuid references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint exercises_system_xor_user check (
    (is_system = true and user_id is null) or (is_system = false and user_id is not null)
  )
);

create unique index exercises_name_unique
  on public.exercises (coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

alter table public.exercises enable row level security;

create policy "exercises_select_system_or_own" on public.exercises
  for select using (is_system = true or auth.uid() = user_id);
create policy "exercises_insert_own" on public.exercises
  for insert with check (is_system = false and auth.uid() = user_id);
create policy "exercises_update_own" on public.exercises
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "exercises_delete_own" on public.exercises
  for delete using (auth.uid() = user_id);

-- ============================================================
-- workout_templates
-- ============================================================
create table public.workout_templates (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  order_index integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.workout_templates enable row level security;

create policy "workout_templates_own" on public.workout_templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- template_exercises
-- ============================================================
create table public.template_exercises (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.workout_templates(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  order_index  integer not null,
  target_sets  integer not null default 3,
  rest_seconds integer not null default 90,
  notes        text
);

create index template_exercises_template_idx on public.template_exercises (template_id, order_index);

alter table public.template_exercises enable row level security;

create policy "template_exercises_own" on public.template_exercises
  for all using (
    exists (
      select 1 from public.workout_templates t
      where t.id = template_exercises.template_id and t.user_id = auth.uid()
    )
  );

-- ============================================================
-- workout_sessions
-- ============================================================
create table public.workout_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  template_id uuid references public.workout_templates(id) on delete set null,
  name        text,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz,
  notes       text
);

create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

alter table public.workout_sessions enable row level security;

create policy "workout_sessions_own" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- workout_sets
-- ============================================================
create table public.workout_sets (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_id  uuid not null references public.exercises(id),
  set_number   integer not null,
  reps         integer,
  weight_kg    numeric,
  rpe          numeric,
  is_warmup    boolean not null default false,
  completed_at timestamptz not null default now()
);

create index workout_sets_session_idx on public.workout_sets (session_id, exercise_id, set_number);
create index workout_sets_exercise_time_idx on public.workout_sets (exercise_id, completed_at desc);

alter table public.workout_sets enable row level security;

create policy "workout_sets_own" on public.workout_sets
  for all using (
    exists (
      select 1 from public.workout_sessions s
      where s.id = workout_sets.session_id and s.user_id = auth.uid()
    )
  );

-- ============================================================
-- food_entries
-- ============================================================
create table public.food_entries (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  logged_for_date date not null,
  input_type      text not null check (input_type in ('text', 'photo')),
  description     text,
  image_path      text,
  calories        integer not null,
  protein_g       numeric not null,
  carbs_g         numeric not null,
  fat_g           numeric not null,
  gemini_raw      jsonb,
  created_at      timestamptz not null default now()
);

create index food_entries_user_date_idx on public.food_entries (user_id, logged_for_date desc);

alter table public.food_entries enable row level security;

create policy "food_entries_own" on public.food_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- health_samples (populated in step 6 when expo-health is wired)
-- ============================================================
create table public.health_samples (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  metric     text not null,
  value      numeric,
  unit       text,
  started_at timestamptz not null,
  ended_at   timestamptz,
  metadata   jsonb,
  hk_uuid    text unique,
  created_at timestamptz not null default now()
);

create index health_samples_user_metric_idx on public.health_samples (user_id, metric, started_at desc);

alter table public.health_samples enable row level security;

create policy "health_samples_own" on public.health_samples
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ============================================================
-- v_exercise_prs: computed PRs per user per exercise
-- ============================================================
create view public.v_exercise_prs
with (security_invoker = true) as
select
  ws.user_id,
  s.exercise_id,
  max(s.weight_kg) filter (where s.reps >= 1 and not s.is_warmup) as max_weight_kg,
  max(s.weight_kg * (1 + s.reps::numeric / 30)) filter (where not s.is_warmup) as max_est_1rm_epley,
  count(*) filter (where not s.is_warmup) as total_working_sets
from public.workout_sets s
join public.workout_sessions ws on ws.id = s.session_id
where s.weight_kg is not null and s.reps is not null
group by ws.user_id, s.exercise_id;

-- ============================================================
-- updated_at trigger for profiles
-- ============================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();
