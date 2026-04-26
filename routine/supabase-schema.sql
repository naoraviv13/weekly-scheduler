-- =============================================
-- Routine App — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- =============================================

-- 1. Templates
create table public.templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  accent     text not null default '#FF4D2E',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Template tasks (belong to a template)
create table public.template_tasks (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  title       text not null,
  time        text not null,        -- e.g. '09:00'
  category    text not null default 'custom',
  sort_order  int not null default 0
);

-- 3. Week assignments (which template is assigned to which day of which week)
create table public.week_assignments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,        -- the Sunday that starts this week
  day_index   int not null check (day_index between 0 and 6),
  template_id uuid references public.templates(id) on delete set null,
  unique (user_id, week_start, day_index)
);

-- 4. One-time tasks (pinned to a specific date)
create table public.one_time_tasks (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  task_date date not null,
  title     text not null,
  time      text not null,
  category  text not null default 'break'
);

-- 5. Completions (tracks checked-off tasks per date)
create table public.completions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  task_date    date not null,
  task_id      uuid not null,        -- references either template_tasks.id or one_time_tasks.id
  is_one_time  boolean not null default false,
  unique (user_id, task_date, task_id)
);

-- =============================================
-- Row Level Security — each user sees only their own data
-- =============================================

alter table public.templates enable row level security;
alter table public.template_tasks enable row level security;
alter table public.week_assignments enable row level security;
alter table public.one_time_tasks enable row level security;
alter table public.completions enable row level security;

-- Templates: user owns them
create policy "Users manage own templates"
  on public.templates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Template tasks: user owns the parent template
create policy "Users manage own template tasks"
  on public.template_tasks for all
  using (template_id in (select id from public.templates where user_id = auth.uid()))
  with check (template_id in (select id from public.templates where user_id = auth.uid()));

-- Week assignments
create policy "Users manage own week assignments"
  on public.week_assignments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One-time tasks
create policy "Users manage own one-time tasks"
  on public.one_time_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Completions
create policy "Users manage own completions"
  on public.completions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================
-- Indexes for common queries
-- =============================================

create index idx_templates_user on public.templates(user_id);
create index idx_template_tasks_template on public.template_tasks(template_id);
create index idx_week_assignments_user_week on public.week_assignments(user_id, week_start);
create index idx_one_time_tasks_user_date on public.one_time_tasks(user_id, task_date);
create index idx_completions_user_date on public.completions(user_id, task_date);
