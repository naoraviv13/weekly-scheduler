-- =============================================
-- Routine App — Weight tracking & custom goals
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Daily weight entries (one per user per day)
create table if not exists public.weight_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  weight_kg  numeric(5, 2) not null check (weight_kg > 0 and weight_kg < 500),
  created_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists idx_weight_entries_user_date
  on public.weight_entries (user_id, entry_date);

alter table public.weight_entries enable row level security;

create policy "Users manage own weight entries"
  on public.weight_entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Custom goals (user-defined goals beyond the 4 defaults)
create table if not exists public.custom_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  category      text not null,           -- one of: workout, boxing, office, wfh, break, custom
  weekly_target int  not null default 1 check (weekly_target between 0 and 21),
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_custom_goals_user
  on public.custom_goals (user_id);

alter table public.custom_goals enable row level security;

create policy "Users manage own custom goals"
  on public.custom_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
