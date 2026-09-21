# Ironlog

A personal strength-training log. Build routines, log sets live with a rest timer,
track personal records and body weight.

Original design and code. Built with React + Vite + Supabase.

## Setup

### 1. Environment

Create `routine/.env`:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

### 2. Database

Open the Supabase SQL Editor and run **`supabase-ironlog-schema.sql`**.

> The script drops the tables from the previous scheduler app
> (`templates`, `template_tasks`, `week_assignments`, `one_time_tasks`,
> `completions`, `goals`, `custom_goals`) and creates the training schema.
> `weight_entries` is preserved, so existing body-weight history carries over.

It also seeds ~50 common exercises as a shared library (`user_id IS NULL`).

### 3. Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
npm run lint
```

## Features

| Area | What it does |
|---|---|
| **Home** | Start an empty session or launch a routine, 7-day totals, quick weight entry |
| **Routines** | Reusable exercise lists with per-exercise target set counts |
| **Workout** | Live logging: weight × reps per set, previous-session reference, PR flags, rest timer |
| **Exercises** | Searchable library filtered by muscle group, plus custom exercises |
| **Progress** | Body-weight chart, activity heatmap, volume/sets/time totals, session history |
| **Profile** | Lifetime totals and training streak |

## How the numbers work

- **Volume** — sum of `weight × reps` across completed, non-warmup sets.
- **Estimated 1RM** — Epley formula: `weight × (1 + reps ÷ 30)`.
- **Personal records** — derived from workout history at read time, never stored,
  so they can't go stale.
- **Streak** — consecutive days containing at least one session. Not training
  today doesn't break a streak until the day ends.

## Architecture

```
src/
├── main.jsx              entry: auth gate + router
├── App.jsx               shell: header, tab bar, active-session banner
├── Auth.jsx              email/password sign in
├── DataContext.jsx       store provider (loads + mutates all data)
├── supabaseData.js       every Supabase query; maps snake_case → camelCase
├── lib/
│   ├── dataContext.js    context object + useData hook
│   ├── training.js       formatting, volume, 1RM, PR derivation
│   └── useRestTimer.js   deadline-based rest countdown
├── components/           Sheet, chips, empty states, exercise picker, rest timer
└── routes/               Home, Routines, RoutineEditor, ActiveWorkout,
                          Exercises, ExerciseDetail, Progress, Profile,
                          WorkoutDetail
```

**Conventions**

- Optimistic UI: local state updates immediately, the write goes out in the
  background, failures log and refetch.
- `snake_case` stays inside `supabaseData.js`; the rest of the app is camelCase.
- Row Level Security on every table — a user can only read and write their own
  rows. Seeded exercises (`user_id IS NULL`) are readable by everyone but
  writable by no one.

## Security notes

- The anon key is a public client key; all access control is enforced by RLS
  policies in the schema, not by the client.
- `.env` is gitignored. Never commit real keys.
