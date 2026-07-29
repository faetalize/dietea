-- Dietea: meal prep planner
-- All app data lives in the `dietea` schema, scoped per user via RLS.

create schema if not exists dietea;

grant usage on schema dietea to authenticated;

-- Shared updated_at trigger
create or replace function dietea.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Body/goal profile plus app preferences. One row per user.
create table dietea.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  onboarded boolean not null default false,
  start_day smallint not null default 1 check (start_day between 0 and 6),
  age smallint check (age between 15 and 100),
  sex text check (sex in ('male', 'female')),
  weight_kg numeric(5, 2) check (weight_kg between 30 and 300),
  height_cm numeric(5, 2) check (height_cm between 100 and 250),
  activity_level numeric(4, 3) not null default 1.55,
  goal_weight_kg numeric(5, 2) check (goal_weight_kg between 30 and 300),
  goal_months smallint check (goal_months between 1 and 24),
  maintenance_calories integer,
  recommended_calories integer,
  checked_items jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Ingredient database. Ids are app-generated slugs, unique per user.
create table dietea.ingredients (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  category text not null default 'Uncategorized',
  unit text not null,
  kcal numeric not null default 0,
  carb_per_unit numeric not null default 0,
  protein_per_unit numeric not null default 0,
  lipid_per_unit numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- Meals. Nested ingredient entries and instruction blocks stay JSONB:
-- entries intentionally keep a denormalized itemName/itemUnit so a meal
-- still renders when its itemId no longer resolves.
create table dietea.meals (
  user_id uuid not null references auth.users (id) on delete cascade,
  id text not null,
  name text not null,
  type text not null check (type in ('Breakfast', 'Lunch', 'Snack', 'Dinner')),
  ingredients jsonb not null default '[]'::jsonb,
  instructions jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- The plan. One row per user; days is the 7-element schedule array.
create table dietea.schedules (
  user_id uuid primary key references auth.users (id) on delete cascade,
  days jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Supplement and hydration tracking, one row per user per day.
-- Keying by day keeps history instead of overwriting yesterday.
create table dietea.supplement_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  completed jsonb not null default '{}'::jsonb,
  water_consumed integer not null default 0 check (water_consumed >= 0),
  bottle_size integer not null default 750 check (bottle_size between 100 and 2000),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

create index ingredients_user_category_idx on dietea.ingredients (user_id, category);
create index meals_user_type_idx on dietea.meals (user_id, type);

create trigger set_updated_at before update on dietea.profiles
  for each row execute function dietea.set_updated_at();
create trigger set_updated_at before update on dietea.ingredients
  for each row execute function dietea.set_updated_at();
create trigger set_updated_at before update on dietea.meals
  for each row execute function dietea.set_updated_at();
create trigger set_updated_at before update on dietea.schedules
  for each row execute function dietea.set_updated_at();
create trigger set_updated_at before update on dietea.supplement_days
  for each row execute function dietea.set_updated_at();

alter table dietea.profiles enable row level security;
alter table dietea.ingredients enable row level security;
alter table dietea.meals enable row level security;
alter table dietea.schedules enable row level security;
alter table dietea.supplement_days enable row level security;

create policy "Users manage their own profile" on dietea.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own ingredients" on dietea.ingredients
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own meals" on dietea.meals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own schedule" on dietea.schedules
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own supplement days" on dietea.supplement_days
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on all tables in schema dietea to authenticated;
