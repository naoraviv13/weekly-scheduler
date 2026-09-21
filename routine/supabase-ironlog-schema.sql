-- =============================================================
-- Ironlog — Phase 1 schema
-- Run this in the Supabase SQL Editor.
--
-- KEEPS:  public.weight_entries (your existing weight history)
-- DROPS:  all Routine scheduler tables
-- ADDS:   exercises, routines, routine_exercises,
--         workouts, workout_exercises, sets
-- =============================================================

-- -------------------------------------------------------------
-- 0. Drop the old scheduler tables
--    weight_entries is deliberately NOT in this list.
-- -------------------------------------------------------------
drop table if exists public.completions       cascade;
drop table if exists public.one_time_tasks    cascade;
drop table if exists public.template_tasks    cascade;
drop table if exists public.week_assignments  cascade;
drop table if exists public.templates         cascade;
drop table if exists public.custom_goals      cascade;
drop table if exists public.goals             cascade;

-- -------------------------------------------------------------
-- 0b. Body weight.
--     Carried over unchanged from the previous app. Created here
--     only so this file also works on a brand-new project.
-- -------------------------------------------------------------
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

drop policy if exists "Users manage own weight entries" on public.weight_entries;
create policy "Users manage own weight entries"
  on public.weight_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 1. Exercise library
--    user_id IS NULL  -> global seed exercise, readable by everyone
--    user_id = auth.uid() -> the user's own custom exercise
-- -------------------------------------------------------------
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  name         text not null,
  muscle_group text not null,
  equipment    text not null default 'barbell',
  is_custom    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_exercises_user  on public.exercises (user_id);
create index if not exists idx_exercises_group on public.exercises (muscle_group);

-- Prevent a user creating two custom exercises with the same name.
create unique index if not exists idx_exercises_user_name_unique
  on public.exercises (user_id, lower(name))
  where user_id is not null;

alter table public.exercises enable row level security;

drop policy if exists "Read global and own exercises" on public.exercises;
create policy "Read global and own exercises"
  on public.exercises for select
  using (user_id is null or auth.uid() = user_id);

drop policy if exists "Insert own exercises" on public.exercises;
create policy "Insert own exercises"
  on public.exercises for insert
  with check (auth.uid() = user_id);

drop policy if exists "Update own exercises" on public.exercises;
create policy "Update own exercises"
  on public.exercises for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Delete own exercises" on public.exercises;
create policy "Delete own exercises"
  on public.exercises for delete
  using (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 2. Routines (reusable workout templates)
-- -------------------------------------------------------------
create table if not exists public.routines (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  notes      text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_routines_user on public.routines (user_id);

alter table public.routines enable row level security;

drop policy if exists "Users manage own routines" on public.routines;
create policy "Users manage own routines"
  on public.routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 3. Exercises inside a routine
-- -------------------------------------------------------------
create table if not exists public.routine_exercises (
  id          uuid primary key default gen_random_uuid(),
  routine_id  uuid not null references public.routines(id)  on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sort_order  int  not null default 0,
  target_sets int  not null default 3 check (target_sets between 1 and 20),
  notes       text
);

create index if not exists idx_routine_exercises_routine
  on public.routine_exercises (routine_id);

alter table public.routine_exercises enable row level security;

-- Ownership is inherited from the parent routine.
drop policy if exists "Users manage own routine exercises" on public.routine_exercises;
create policy "Users manage own routine exercises"
  on public.routine_exercises for all
  using (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  ));

-- -------------------------------------------------------------
-- 4. Workouts (a logged session)
--    ended_at IS NULL -> the session is still in progress
-- -------------------------------------------------------------
create table if not exists public.workouts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  routine_id uuid references public.routines(id) on delete set null,
  name       text not null default 'Workout',
  kind       text not null default 'lifting' check (kind in ('lifting', 'cardio')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  notes      text,
  -- Phase 3 cardio fields, unused by lifting sessions.
  duration_seconds int,
  distance_km      numeric(6, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_workouts_user_started
  on public.workouts (user_id, started_at desc);

-- Fast lookup of the single in-progress session.
create index if not exists idx_workouts_active
  on public.workouts (user_id) where ended_at is null;

alter table public.workouts enable row level security;

drop policy if exists "Users manage own workouts" on public.workouts;
create policy "Users manage own workouts"
  on public.workouts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 5. Exercise instances within a workout
-- -------------------------------------------------------------
create table if not exists public.workout_exercises (
  id          uuid primary key default gen_random_uuid(),
  workout_id  uuid not null references public.workouts(id)  on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  sort_order  int  not null default 0,
  notes       text
);

create index if not exists idx_workout_exercises_workout
  on public.workout_exercises (workout_id);

alter table public.workout_exercises enable row level security;

drop policy if exists "Users manage own workout exercises" on public.workout_exercises;
create policy "Users manage own workout exercises"
  on public.workout_exercises for all
  using (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workouts w
    where w.id = workout_id and w.user_id = auth.uid()
  ));

-- -------------------------------------------------------------
-- 6. Individual sets
-- -------------------------------------------------------------
create table if not exists public.sets (
  id                  uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade,
  set_index           int  not null default 0,
  weight_kg           numeric(6, 2) not null default 0 check (weight_kg >= 0 and weight_kg < 1000),
  reps                int  not null default 0 check (reps >= 0 and reps <= 1000),
  rpe                 numeric(3, 1) check (rpe >= 0 and rpe <= 10),
  is_warmup           boolean not null default false,
  is_complete         boolean not null default false,
  completed_at        timestamptz
);

create index if not exists idx_sets_workout_exercise
  on public.sets (workout_exercise_id);

alter table public.sets enable row level security;

drop policy if exists "Users manage own sets" on public.sets;
create policy "Users manage own sets"
  on public.sets for all
  using (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = workout_exercise_id and w.user_id = auth.uid()
  ));

-- -------------------------------------------------------------
-- 7. Seed the global exercise library (user_id IS NULL)
--    Safe to re-run: skipped entirely if seeds already exist.
-- -------------------------------------------------------------
insert into public.exercises (user_id, name, muscle_group, equipment, is_custom)
select * from (values
  (null::uuid, 'Barbell Bench Press',        'chest',      'barbell',   false),
  (null::uuid, 'Incline Barbell Bench Press','chest',      'barbell',   false),
  (null::uuid, 'Dumbbell Bench Press',       'chest',      'dumbbell',  false),
  (null::uuid, 'Incline Dumbbell Press',     'chest',      'dumbbell',  false),
  (null::uuid, 'Cable Chest Fly',            'chest',      'cable',     false),
  (null::uuid, 'Push-Up',                    'chest',      'bodyweight',false),
  (null::uuid, 'Chest Dip',                  'chest',      'bodyweight',false),

  (null::uuid, 'Deadlift',                   'back',       'barbell',   false),
  (null::uuid, 'Barbell Row',                'back',       'barbell',   false),
  (null::uuid, 'Pull-Up',                    'back',       'bodyweight',false),
  (null::uuid, 'Chin-Up',                    'back',       'bodyweight',false),
  (null::uuid, 'Lat Pulldown',               'back',       'cable',     false),
  (null::uuid, 'Seated Cable Row',           'back',       'cable',     false),
  (null::uuid, 'Dumbbell Row',               'back',       'dumbbell',  false),
  (null::uuid, 'T-Bar Row',                  'back',       'machine',   false),

  (null::uuid, 'Back Squat',                 'legs',       'barbell',   false),
  (null::uuid, 'Front Squat',                'legs',       'barbell',   false),
  (null::uuid, 'Romanian Deadlift',          'legs',       'barbell',   false),
  (null::uuid, 'Leg Press',                  'legs',       'machine',   false),
  (null::uuid, 'Bulgarian Split Squat',      'legs',       'dumbbell',  false),
  (null::uuid, 'Walking Lunge',              'legs',       'dumbbell',  false),
  (null::uuid, 'Leg Extension',              'legs',       'machine',   false),
  (null::uuid, 'Lying Leg Curl',             'legs',       'machine',   false),
  (null::uuid, 'Standing Calf Raise',        'legs',       'machine',   false),
  (null::uuid, 'Hip Thrust',                 'legs',       'barbell',   false),

  (null::uuid, 'Overhead Press',             'shoulders',  'barbell',   false),
  (null::uuid, 'Seated Dumbbell Press',      'shoulders',  'dumbbell',  false),
  (null::uuid, 'Lateral Raise',              'shoulders',  'dumbbell',  false),
  (null::uuid, 'Rear Delt Fly',              'shoulders',  'dumbbell',  false),
  (null::uuid, 'Face Pull',                  'shoulders',  'cable',     false),
  (null::uuid, 'Barbell Shrug',              'shoulders',  'barbell',   false),

  (null::uuid, 'Barbell Curl',               'arms',       'barbell',   false),
  (null::uuid, 'Dumbbell Curl',              'arms',       'dumbbell',  false),
  (null::uuid, 'Hammer Curl',                'arms',       'dumbbell',  false),
  (null::uuid, 'Preacher Curl',              'arms',       'machine',   false),
  (null::uuid, 'Cable Tricep Pushdown',      'arms',       'cable',     false),
  (null::uuid, 'Overhead Tricep Extension',  'arms',       'dumbbell',  false),
  (null::uuid, 'Skull Crusher',              'arms',       'barbell',   false),
  (null::uuid, 'Close-Grip Bench Press',     'arms',       'barbell',   false),

  (null::uuid, 'Plank',                      'core',       'bodyweight',false),
  (null::uuid, 'Hanging Leg Raise',          'core',       'bodyweight',false),
  (null::uuid, 'Cable Crunch',               'core',       'cable',     false),
  (null::uuid, 'Russian Twist',              'core',       'bodyweight',false),
  (null::uuid, 'Ab Wheel Rollout',           'core',       'bodyweight',false),

  (null::uuid, 'Running',                    'cardio',     'none',      false),
  (null::uuid, 'Cycling',                    'cardio',     'machine',   false),
  (null::uuid, 'Rowing Machine',             'cardio',     'machine',   false),
  (null::uuid, 'Jump Rope',                  'cardio',     'none',      false),
  (null::uuid, 'Boxing',                     'cardio',     'none',      false),
  (null::uuid, 'Jiu-Jitsu',                  'cardio',     'none',      false),
  (null::uuid, 'Football',                   'cardio',     'none',      false)
) as seed(user_id, name, muscle_group, equipment, is_custom)
where not exists (
  select 1 from public.exercises where user_id is null
);
