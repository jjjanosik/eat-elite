-- Phase 1 schema for Eat Elite MVP

create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sex text check (sex in ('male', 'female', 'other')),
  birthdate date,
  diet_type text check (diet_type in ('classic', 'vegetarian', 'vegan', 'pescetarian')),
  diet_goals jsonb not null default '[]'::jsonb,
  outcomes jsonb not null default '[]'::jsonb,
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_score_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score_version int not null default 1,
  weights_version int not null default 1,
  nutrition_weight int not null,
  additives_weight int not null,
  nutrition_subweights jsonb not null default '{}'::jsonb,
  additives_subweights jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_score_weights_sum_check check ((nutrition_weight + additives_weight) = 100)
);

create unique index if not exists user_score_weights_user_id_idx on public.user_score_weights(user_id);

create table if not exists public.products (
  barcode text primary key,
  name text,
  brands text,
  image_url text,
  ingredients_text text,
  additives_tags jsonb not null default '[]'::jsonb,
  nutriments jsonb not null default '{}'::jsonb,
  off_payload jsonb not null default '{}'::jsonb,
  source text not null default 'OFF',
  source_last_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scan_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text not null references public.products(barcode),
  score int not null,
  score_version int not null,
  weights_version int not null,
  inputs_snapshot jsonb not null,
  ai_model text not null default 'grok',
  ai_response text,
  ai_cached boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists scan_history_user_created_at_idx on public.scan_history(user_id, created_at desc);
create index if not exists scan_history_user_barcode_created_at_idx on public.scan_history(user_id, barcode, created_at desc);

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counter_type text not null check (counter_type in ('scan_monthly', 'regen_hourly')),
  bucket_start timestamptz not null,
  count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, counter_type, bucket_start)
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
before update on public.user_profiles
for each row
execute function public.handle_updated_at();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
before update on public.products
for each row
execute function public.handle_updated_at();

drop trigger if exists usage_counters_updated_at on public.usage_counters;
create trigger usage_counters_updated_at
before update on public.usage_counters
for each row
execute function public.handle_updated_at();

alter table public.user_profiles enable row level security;
alter table public.user_score_weights enable row level security;
alter table public.products enable row level security;
alter table public.scan_history enable row level security;
alter table public.usage_counters enable row level security;

-- user_profiles policies
drop policy if exists "users manage own profile" on public.user_profiles;
create policy "users manage own profile"
on public.user_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- user_score_weights policies
drop policy if exists "users manage own weights" on public.user_score_weights;
create policy "users manage own weights"
on public.user_score_weights
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- products policies (shared catalog cache)
drop policy if exists "authenticated read products" on public.products;
create policy "authenticated read products"
on public.products
for select
to authenticated
using (true);

drop policy if exists "authenticated write products" on public.products;
create policy "authenticated write products"
on public.products
for insert
to authenticated
with check (true);

drop policy if exists "authenticated update products" on public.products;
create policy "authenticated update products"
on public.products
for update
to authenticated
using (true)
with check (true);

-- scan_history policies
drop policy if exists "users manage own history" on public.scan_history;
create policy "users manage own history"
on public.scan_history
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- usage counters policies
drop policy if exists "users manage own counters" on public.usage_counters;
create policy "users manage own counters"
on public.usage_counters
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create or replace function public.increment_usage_counter(
  p_user_id uuid,
  p_counter_type text,
  p_bucket_start timestamptz,
  p_max_count int
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_count int;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then
    raise exception 'unauthorized_counter_access';
  end if;

  insert into public.usage_counters(user_id, counter_type, bucket_start, count)
  values (p_user_id, p_counter_type, p_bucket_start, 1)
  on conflict(user_id, counter_type, bucket_start)
  do update set count = usage_counters.count + 1
  returning count into v_new_count;

  if v_new_count > p_max_count then
    raise exception 'rate_limit_exceeded';
  end if;

  return v_new_count;
end;
$$;

revoke all on function public.increment_usage_counter(uuid, text, timestamptz, int) from public;
grant execute on function public.increment_usage_counter(uuid, text, timestamptz, int) to authenticated;
