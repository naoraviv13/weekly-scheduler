-- Add user_goals table for weekly goal tracking
-- Run this in Supabase SQL Editor

create table public.user_goals (
  user_id  uuid primary key references auth.users(id) on delete cascade,
  workouts int not null default 4,
  boxing   int not null default 2,
  office   int not null default 3,
  wfh      int not null default 2
);

alter table public.user_goals enable row level security;

create policy "Users manage own goals"
  on public.user_goals for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
