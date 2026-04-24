alter table food_entries
  add column if not exists fiber_g        numeric,
  add column if not exists sugar_g        numeric,
  add column if not exists saturated_fat_g numeric,
  add column if not exists sodium_mg      numeric;
