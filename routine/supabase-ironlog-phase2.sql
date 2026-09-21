-- =============================================================
-- Ironlog — Phase 2: body measurements
-- Run this in the Supabase SQL Editor.
--
-- Additive only. Drops nothing, and does not touch any table
-- created by supabase-ironlog-schema.sql.
-- =============================================================

-- Long format (one row per metric per day) rather than a column
-- per body part, so new metrics never need a migration.
create table if not exists public.body_measurements (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  metric     text not null,
  value      numeric(6, 2) not null check (value > 0 and value < 1000),
  unit       text not null default 'cm' check (unit in ('cm', 'percent')),
  created_at timestamptz not null default now(),
  unique (user_id, entry_date, metric)
);

create index if not exists idx_body_measurements_user_date
  on public.body_measurements (user_id, entry_date);

create index if not exists idx_body_measurements_metric
  on public.body_measurements (user_id, metric, entry_date);

alter table public.body_measurements enable row level security;

drop policy if exists "Users manage own measurements" on public.body_measurements;
create policy "Users manage own measurements"
  on public.body_measurements for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
