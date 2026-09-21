import { supabase } from './supabaseClient';

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function dateKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(d, n) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

// ---------------------------------------------------------------------------
// Row mappers — keep snake_case confined to this module.
// ---------------------------------------------------------------------------

const mapExercise = (r) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  muscleGroup: r.muscle_group,
  equipment: r.equipment,
  isCustom: r.is_custom,
});

const mapSet = (r) => ({
  id: r.id,
  workoutExerciseId: r.workout_exercise_id,
  setIndex: r.set_index,
  weightKg: r.weight_kg === null ? 0 : Number(r.weight_kg),
  reps: r.reps ?? 0,
  rpe: r.rpe === null || r.rpe === undefined ? null : Number(r.rpe),
  isWarmup: r.is_warmup,
  isComplete: r.is_complete,
  completedAt: r.completed_at,
});

const mapWorkoutExercise = (r) => ({
  id: r.id,
  workoutId: r.workout_id,
  exerciseId: r.exercise_id,
  sortOrder: r.sort_order,
  notes: r.notes,
  exercise: r.exercises ? mapExercise(r.exercises) : null,
  sets: (r.sets || []).map(mapSet).sort((a, b) => a.setIndex - b.setIndex),
});

const mapWorkout = (r) => ({
  id: r.id,
  userId: r.user_id,
  routineId: r.routine_id,
  name: r.name,
  kind: r.kind,
  startedAt: r.started_at,
  endedAt: r.ended_at,
  notes: r.notes,
  exercises: (r.workout_exercises || [])
    .map(mapWorkoutExercise)
    .sort((a, b) => a.sortOrder - b.sortOrder),
});

const mapRoutine = (r) => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  notes: r.notes,
  sortOrder: r.sort_order,
  exercises: (r.routine_exercises || [])
    .map((re) => ({
      id: re.id,
      exerciseId: re.exercise_id,
      sortOrder: re.sort_order,
      targetSets: re.target_sets,
      notes: re.notes,
      exercise: re.exercises ? mapExercise(re.exercises) : null,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder),
});

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

export async function fetchExercises() {
  const { data, error } = await supabase.from('exercises').select('*').order('name');
  if (error) throw error;
  return data.map(mapExercise);
}

export async function addCustomExercise(userId, { name, muscleGroup, equipment }) {
  const { data, error } = await supabase
    .from('exercises')
    .insert({
      user_id: userId,
      name,
      muscle_group: muscleGroup,
      equipment: equipment || 'barbell',
      is_custom: true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapExercise(data);
}

export async function updateExercise(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.muscleGroup !== undefined) row.muscle_group = patch.muscleGroup;
  if (patch.equipment !== undefined) row.equipment = patch.equipment;

  const { data, error } = await supabase
    .from('exercises')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapExercise(data);
}

export async function deleteExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------

export async function fetchRoutines() {
  const { data, error } = await supabase
    .from('routines')
    .select('*, routine_exercises(*, exercises(*))')
    .order('sort_order');
  if (error) throw error;
  return data.map(mapRoutine);
}

/**
 * Create or replace a routine and its exercise list.
 * `exercises` is [{ exerciseId, targetSets, notes }] in display order.
 */
export async function upsertRoutine(userId, routine) {
  const isNew = !routine.id;

  const { data: rData, error: rErr } = isNew
    ? await supabase
        .from('routines')
        .insert({
          user_id: userId,
          name: routine.name,
          notes: routine.notes || null,
          sort_order: routine.sortOrder ?? 0,
        })
        .select()
        .single()
    : await supabase
        .from('routines')
        .update({ name: routine.name, notes: routine.notes || null })
        .eq('id', routine.id)
        .select()
        .single();
  if (rErr) throw rErr;

  const routineId = rData.id;

  await supabase.from('routine_exercises').delete().eq('routine_id', routineId);

  const list = routine.exercises || [];
  if (list.length > 0) {
    const rows = list.map((e, i) => ({
      routine_id: routineId,
      exercise_id: e.exerciseId,
      sort_order: i,
      target_sets: e.targetSets ?? 3,
      notes: e.notes || null,
    }));
    const { error: reErr } = await supabase.from('routine_exercises').insert(rows);
    if (reErr) throw reErr;
  }

  const { data: full, error: fErr } = await supabase
    .from('routines')
    .select('*, routine_exercises(*, exercises(*))')
    .eq('id', routineId)
    .single();
  if (fErr) throw fErr;
  return mapRoutine(full);
}

export async function deleteRoutine(id) {
  const { error } = await supabase.from('routines').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

const WORKOUT_SELECT = '*, workout_exercises(*, exercises(*), sets(*))';

/** The single in-progress session, or null. */
export async function fetchActiveWorkout() {
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data.length > 0 ? mapWorkout(data[0]) : null;
}

export async function fetchWorkoutById(id) {
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .eq('id', id)
    .single();
  if (error) throw error;
  return mapWorkout(data);
}

export async function fetchWorkoutHistory(limit = 100) {
  const { data, error } = await supabase
    .from('workouts')
    .select(WORKOUT_SELECT)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map(mapWorkout);
}

/**
 * Start a session. When `routine` is supplied, its exercises are pre-loaded
 * with the right number of empty sets so the user can log straight away.
 */
export async function startWorkout(userId, { routine, name } = {}) {
  const { data: wData, error: wErr } = await supabase
    .from('workouts')
    .insert({
      user_id: userId,
      routine_id: routine?.id || null,
      name: name || routine?.name || 'Quick Workout',
      kind: 'lifting',
    })
    .select()
    .single();
  if (wErr) throw wErr;

  const workoutId = wData.id;

  if (routine?.exercises?.length) {
    const weRows = routine.exercises.map((re, i) => ({
      workout_id: workoutId,
      exercise_id: re.exerciseId,
      sort_order: i,
      notes: re.notes || null,
    }));
    const { data: weData, error: weErr } = await supabase
      .from('workout_exercises')
      .insert(weRows)
      .select();
    if (weErr) throw weErr;

    // Seed each exercise with its target number of blank sets.
    const setRows = [];
    weData.forEach((we) => {
      const source = routine.exercises.find((re) => re.exerciseId === we.exercise_id);
      const target = source?.targetSets ?? 3;
      for (let i = 0; i < target; i++) {
        setRows.push({
          workout_exercise_id: we.id,
          set_index: i,
          weight_kg: 0,
          reps: 0,
          is_complete: false,
        });
      }
    });
    if (setRows.length > 0) {
      const { error: sErr } = await supabase.from('sets').insert(setRows);
      if (sErr) throw sErr;
    }
  }

  return fetchWorkoutById(workoutId);
}

export async function finishWorkout(id, { notes } = {}) {
  const patch = { ended_at: new Date().toISOString() };
  if (notes !== undefined) patch.notes = notes;

  const { error } = await supabase.from('workouts').update(patch).eq('id', id);
  if (error) throw error;
  return fetchWorkoutById(id);
}

export async function updateWorkout(id, patch) {
  const row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.notes !== undefined) row.notes = patch.notes;

  const { error } = await supabase.from('workouts').update(row).eq('id', id);
  if (error) throw error;
}

export async function deleteWorkout(id) {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Workout exercises + sets
// ---------------------------------------------------------------------------

export async function addWorkoutExercise(workoutId, exerciseId, sortOrder) {
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: workoutId, exercise_id: exerciseId, sort_order: sortOrder })
    .select('*, exercises(*), sets(*)')
    .single();
  if (error) throw error;
  return mapWorkoutExercise(data);
}

export async function removeWorkoutExercise(id) {
  const { error } = await supabase.from('workout_exercises').delete().eq('id', id);
  if (error) throw error;
}

export async function addSet(workoutExerciseId, { setIndex, weightKg, reps, isWarmup }) {
  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_exercise_id: workoutExerciseId,
      set_index: setIndex,
      weight_kg: weightKg ?? 0,
      reps: reps ?? 0,
      is_warmup: isWarmup ?? false,
      is_complete: false,
    })
    .select()
    .single();
  if (error) throw error;
  return mapSet(data);
}

export async function updateSet(id, patch) {
  const row = {};
  if (patch.weightKg !== undefined) row.weight_kg = patch.weightKg;
  if (patch.reps !== undefined) row.reps = patch.reps;
  if (patch.rpe !== undefined) row.rpe = patch.rpe;
  if (patch.isWarmup !== undefined) row.is_warmup = patch.isWarmup;
  if (patch.isComplete !== undefined) {
    row.is_complete = patch.isComplete;
    row.completed_at = patch.isComplete ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('sets')
    .update(row)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapSet(data);
}

export async function deleteSet(id) {
  const { error } = await supabase.from('sets').delete().eq('id', id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Weight entries (carried over from the previous app)
// ---------------------------------------------------------------------------

export async function fetchWeightEntries(userId, days = 365) {
  const since = dateKey(addDays(new Date(), -days));
  const { data, error } = await supabase
    .from('weight_entries')
    .select('*')
    .gte('entry_date', since)
    .order('entry_date');
  if (error) throw error;
  return data.map((r) => ({ date: r.entry_date, weight: Number(r.weight_kg) }));
}

export async function upsertWeightEntry(userId, date, weight) {
  const { data, error } = await supabase
    .from('weight_entries')
    .upsert(
      { user_id: userId, entry_date: date, weight_kg: weight },
      { onConflict: 'user_id,entry_date' },
    )
    .select()
    .single();
  if (error) throw error;
  return { date: data.entry_date, weight: Number(data.weight_kg) };
}

export async function deleteWeightEntry(userId, date) {
  const { error } = await supabase
    .from('weight_entries')
    .delete()
    .eq('user_id', userId)
    .eq('entry_date', date);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Body measurements
// ---------------------------------------------------------------------------

const mapMeasurement = (r) => ({
  id: r.id,
  date: r.entry_date,
  metric: r.metric,
  value: Number(r.value),
  unit: r.unit,
});

export async function fetchMeasurements(userId, days = 365) {
  const since = dateKey(addDays(new Date(), -days));
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .gte('entry_date', since)
    .order('entry_date');
  if (error) throw error;
  return data.map(mapMeasurement);
}

export async function upsertMeasurement(userId, date, metric, value, unit = 'cm') {
  const { data, error } = await supabase
    .from('body_measurements')
    .upsert(
      { user_id: userId, entry_date: date, metric, value, unit },
      { onConflict: 'user_id,entry_date,metric' },
    )
    .select()
    .single();
  if (error) throw error;
  return mapMeasurement(data);
}

export async function deleteMeasurement(userId, date, metric) {
  const { error } = await supabase
    .from('body_measurements')
    .delete()
    .eq('user_id', userId)
    .eq('entry_date', date)
    .eq('metric', metric);
  if (error) throw error;
}
