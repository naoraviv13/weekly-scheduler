-- =============================================================
-- Ironlog — expanded exercise library
-- Run this in the Supabase SQL Editor.
--
-- Additive only. Drops nothing.
--
-- Safe to re-run: every row is guarded by a name check, so
-- existing exercises are never duplicated and any rows added
-- in a later version of this file will be picked up.
-- =============================================================

insert into public.exercises (user_id, name, muscle_group, equipment, is_custom)
select null, v.name, v.muscle_group, v.equipment, false
from (values
  -- ---------------- CHEST ----------------
  ('Cable Crossover',                 'chest',     'cable'),
  ('Low-to-High Cable Fly',           'chest',     'cable'),
  ('High-to-Low Cable Fly',           'chest',     'cable'),
  ('Cable Chest Press',               'chest',     'cable'),
  ('Single-Arm Cable Press',          'chest',     'cable'),
  ('Decline Barbell Bench Press',     'chest',     'barbell'),
  ('Decline Dumbbell Press',          'chest',     'dumbbell'),
  ('Dumbbell Fly',                    'chest',     'dumbbell'),
  ('Incline Dumbbell Fly',            'chest',     'dumbbell'),
  ('Dumbbell Pullover',               'chest',     'dumbbell'),
  ('Pec Deck',                        'chest',     'machine'),
  ('Chest Press Machine',             'chest',     'machine'),
  ('Incline Chest Press Machine',     'chest',     'machine'),
  ('Plate-Loaded Chest Press',        'chest',     'plate-loaded'),
  ('Plate-Loaded Incline Press',      'chest',     'plate-loaded'),
  ('Plate-Loaded Decline Press',      'chest',     'plate-loaded'),
  ('Smith Machine Bench Press',       'chest',     'smith'),
  ('Smith Machine Incline Press',     'chest',     'smith'),
  ('Diamond Push-Up',                 'chest',     'bodyweight'),
  ('Decline Push-Up',                 'chest',     'bodyweight'),
  ('Incline Push-Up',                 'chest',     'bodyweight'),
  ('Band Chest Press',                'chest',     'band'),

  -- ---------------- BACK ----------------
  ('Straight-Arm Cable Pulldown',     'back',      'cable'),
  ('Cable Pullover',                  'back',      'cable'),
  ('Single-Arm Cable Row',            'back',      'cable'),
  ('Wide-Grip Cable Row',             'back',      'cable'),
  ('Close-Grip Lat Pulldown',         'back',      'cable'),
  ('Wide-Grip Lat Pulldown',          'back',      'cable'),
  ('Reverse-Grip Lat Pulldown',       'back',      'cable'),
  ('Single-Arm Lat Pulldown',         'back',      'cable'),
  ('Pendlay Row',                     'back',      'barbell'),
  ('Rack Pull',                       'back',      'barbell'),
  ('Sumo Deadlift',                   'back',      'barbell'),
  ('Barbell Deficit Deadlift',        'back',      'barbell'),
  ('Chest-Supported Row',             'back',      'dumbbell'),
  ('Incline Dumbbell Row',            'back',      'dumbbell'),
  ('Renegade Row',                    'back',      'dumbbell'),
  ('Plate-Loaded Row',                'back',      'plate-loaded'),
  ('Plate-Loaded High Row',           'back',      'plate-loaded'),
  ('Plate-Loaded Lat Pulldown',       'back',      'plate-loaded'),
  ('Iso-Lateral Row',                 'back',      'plate-loaded'),
  ('Seated Row Machine',              'back',      'machine'),
  ('Assisted Pull-Up Machine',        'back',      'machine'),
  ('Back Extension',                  'back',      'machine'),
  ('Smith Machine Row',               'back',      'smith'),
  ('Inverted Row',                    'back',      'bodyweight'),
  ('Wide-Grip Pull-Up',               'back',      'bodyweight'),
  ('Neutral-Grip Pull-Up',            'back',      'bodyweight'),
  ('Hyperextension',                  'back',      'bodyweight'),
  ('Band Pull-Apart',                 'back',      'band'),

  -- ---------------- LEGS ----------------
  ('Hack Squat',                      'legs',      'machine'),
  ('Seated Leg Curl',                 'legs',      'machine'),
  ('Standing Leg Curl',               'legs',      'machine'),
  ('Hip Abduction Machine',           'legs',      'machine'),
  ('Hip Adduction Machine',           'legs',      'machine'),
  ('Seated Calf Raise',               'legs',      'machine'),
  ('Leg Press Calf Raise',            'legs',      'machine'),
  ('Single-Leg Press',                'legs',      'machine'),
  ('Smith Machine Squat',             'legs',      'smith'),
  ('Smith Machine Calf Raise',        'legs',      'smith'),
  ('Smith Machine Lunge',             'legs',      'smith'),
  ('Goblet Squat',                    'legs',      'dumbbell'),
  ('Dumbbell Romanian Deadlift',      'legs',      'dumbbell'),
  ('Reverse Lunge',                   'legs',      'dumbbell'),
  ('Lateral Lunge',                   'legs',      'dumbbell'),
  ('Step-Up',                         'legs',      'dumbbell'),
  ('Dumbbell Calf Raise',             'legs',      'dumbbell'),
  ('Overhead Squat',                  'legs',      'barbell'),
  ('Barbell Lunge',                   'legs',      'barbell'),
  ('Stiff-Leg Deadlift',              'legs',      'barbell'),
  ('Good Morning',                    'legs',      'barbell'),
  ('Box Squat',                       'legs',      'barbell'),
  ('Pause Squat',                     'legs',      'barbell'),
  ('Cable Pull-Through',              'legs',      'cable'),
  ('Cable Glute Kickback',            'legs',      'cable'),
  ('Cable Squat',                     'legs',      'cable'),
  ('Sissy Squat',                     'legs',      'bodyweight'),
  ('Nordic Hamstring Curl',           'legs',      'bodyweight'),
  ('Glute Bridge',                    'legs',      'bodyweight'),
  ('Pistol Squat',                    'legs',      'bodyweight'),
  ('Box Jump',                        'legs',      'bodyweight'),
  ('Banded Lateral Walk',             'legs',      'band'),
  ('Kettlebell Goblet Squat',         'legs',      'kettlebell'),

  -- ---------------- SHOULDERS ----------------
  ('Cable Lateral Raise',             'shoulders', 'cable'),
  ('Cable Front Raise',               'shoulders', 'cable'),
  ('Cable Rear Delt Fly',             'shoulders', 'cable'),
  ('Cable Upright Row',               'shoulders', 'cable'),
  ('Cable Shrug',                     'shoulders', 'cable'),
  ('Arnold Press',                    'shoulders', 'dumbbell'),
  ('Dumbbell Front Raise',            'shoulders', 'dumbbell'),
  ('Dumbbell Shrug',                  'shoulders', 'dumbbell'),
  ('Seated Lateral Raise',            'shoulders', 'dumbbell'),
  ('Leaning Lateral Raise',           'shoulders', 'dumbbell'),
  ('Reverse Pec Deck',                'shoulders', 'machine'),
  ('Shoulder Press Machine',          'shoulders', 'machine'),
  ('Lateral Raise Machine',           'shoulders', 'machine'),
  ('Plate-Loaded Shoulder Press',     'shoulders', 'plate-loaded'),
  ('Smith Machine Shoulder Press',    'shoulders', 'smith'),
  ('Push Press',                      'shoulders', 'barbell'),
  ('Barbell Upright Row',             'shoulders', 'barbell'),
  ('Barbell Front Raise',             'shoulders', 'barbell'),
  ('Landmine Press',                  'shoulders', 'barbell'),
  ('Behind-the-Neck Press',           'shoulders', 'barbell'),
  ('Band Face Pull',                  'shoulders', 'band'),
  ('Pike Push-Up',                    'shoulders', 'bodyweight'),
  ('Handstand Push-Up',               'shoulders', 'bodyweight'),
  ('Kettlebell Clean and Press',      'shoulders', 'kettlebell'),
  ('Kettlebell Snatch',               'shoulders', 'kettlebell'),

  -- ---------------- ARMS ----------------
  ('Cable Hammer Curl',               'arms',      'cable'),
  ('Cable Bicep Curl',                'arms',      'cable'),
  ('Overhead Cable Curl',             'arms',      'cable'),
  ('Cable Concentration Curl',        'arms',      'cable'),
  ('Rope Tricep Pushdown',            'arms',      'cable'),
  ('Reverse-Grip Tricep Pushdown',    'arms',      'cable'),
  ('Single-Arm Tricep Pushdown',      'arms',      'cable'),
  ('Cable Overhead Tricep Extension', 'arms',      'cable'),
  ('Cable Tricep Kickback',           'arms',      'cable'),
  ('Incline Hammer Curl',             'arms',      'dumbbell'),
  ('Cross-Body Hammer Curl',          'arms',      'dumbbell'),
  ('Seated Hammer Curl',              'arms',      'dumbbell'),
  ('Incline Dumbbell Curl',           'arms',      'dumbbell'),
  ('Concentration Curl',              'arms',      'dumbbell'),
  ('Zottman Curl',                    'arms',      'dumbbell'),
  ('Spider Curl',                     'arms',      'dumbbell'),
  ('Dumbbell Skull Crusher',          'arms',      'dumbbell'),
  ('Dumbbell Tricep Kickback',        'arms',      'dumbbell'),
  ('Farmer''s Carry',                 'arms',      'dumbbell'),
  ('EZ-Bar Curl',                     'arms',      'barbell'),
  ('Reverse Curl',                    'arms',      'barbell'),
  ('Barbell Wrist Curl',              'arms',      'barbell'),
  ('Reverse Wrist Curl',              'arms',      'barbell'),
  ('Preacher Curl Machine',           'arms',      'machine'),
  ('Tricep Extension Machine',        'arms',      'machine'),
  ('Tricep Dip',                      'arms',      'bodyweight'),
  ('Bench Dip',                       'arms',      'bodyweight'),

  -- ---------------- CORE ----------------
  ('Cable Woodchopper',               'core',      'cable'),
  ('Cable Pallof Press',              'core',      'cable'),
  ('Cable Side Bend',                 'core',      'cable'),
  ('Ab Crunch Machine',               'core',      'machine'),
  ('Captain''s Chair Leg Raise',      'core',      'machine'),
  ('Hanging Knee Raise',              'core',      'bodyweight'),
  ('Bicycle Crunch',                  'core',      'bodyweight'),
  ('Reverse Crunch',                  'core',      'bodyweight'),
  ('Flutter Kick',                    'core',      'bodyweight'),
  ('Side Plank',                      'core',      'bodyweight'),
  ('Mountain Climber',                'core',      'bodyweight'),
  ('Dead Bug',                        'core',      'bodyweight'),
  ('Bird Dog',                        'core',      'bodyweight'),
  ('V-Up',                            'core',      'bodyweight'),
  ('Sit-Up',                          'core',      'bodyweight'),
  ('Hollow Body Hold',                'core',      'bodyweight'),
  ('Dragon Flag',                     'core',      'bodyweight'),
  ('Landmine Twist',                  'core',      'barbell'),
  ('Turkish Get-Up',                  'core',      'kettlebell'),

  -- ---------------- CARDIO / CONDITIONING ----------------
  ('Elliptical',                      'cardio',    'machine'),
  ('Stair Climber',                   'cardio',    'machine'),
  ('Assault Bike',                    'cardio',    'machine'),
  ('Treadmill Walk',                  'cardio',    'machine'),
  ('Incline Treadmill Walk',          'cardio',    'machine'),
  ('Ski Erg',                         'cardio',    'machine'),
  ('Swimming',                        'cardio',    'none'),
  ('Sled Push',                       'cardio',    'none'),
  ('Sled Pull',                       'cardio',    'none'),
  ('Battle Ropes',                    'cardio',    'none'),
  ('Hiking',                          'cardio',    'none'),
  ('Basketball',                      'cardio',    'none'),
  ('Tennis',                          'cardio',    'none'),
  ('Padel',                           'cardio',    'none'),
  ('Muay Thai',                       'cardio',    'none'),
  ('Yoga',                            'cardio',    'none'),
  ('Mobility Work',                   'cardio',    'none'),
  ('Burpee',                          'cardio',    'bodyweight'),
  ('Kettlebell Swing',                'cardio',    'kettlebell')
) as v(name, muscle_group, equipment)
where not exists (
  select 1 from public.exercises e
  where e.user_id is null
    and lower(e.name) = lower(v.name)
);

-- -------------------------------------------------------------
-- Guard against future duplicates in the shared library.
-- Custom exercises already have their own per-user unique index.
-- -------------------------------------------------------------
create unique index if not exists idx_exercises_global_name_unique
  on public.exercises (lower(name))
  where user_id is null;
