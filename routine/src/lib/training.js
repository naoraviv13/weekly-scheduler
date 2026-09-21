// ---------------------------------------------------------------------------
// Formatting + training math
// ---------------------------------------------------------------------------

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'cardio',
];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'none',
];

/** Accent colour per muscle group, used for chips and charts. */
export const GROUP_COLOR = {
  chest: '#ff5c38',
  back: '#3ba9ff',
  legs: '#ccff00',
  shoulders: '#c07cff',
  arms: '#2fd98a',
  core: '#ffc23b',
  cardio: '#ff5c9d',
};

export function groupColor(group) {
  return GROUP_COLOR[group] || '#8a8a99';
}

// --- numbers ---------------------------------------------------------------

/** Trim trailing zeros: 100.00 -> "100", 22.50 -> "22.5" */
export function trimNum(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return String(Math.round(Number(n) * 100) / 100);
}

export function formatVolume(kg) {
  if (kg >= 1000) return `${trimNum(Math.round(kg / 100) / 10)}k`;
  return trimNum(Math.round(kg));
}

// --- durations -------------------------------------------------------------

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

export function formatClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

export function elapsedSeconds(startedAt, endedAt) {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
}

// --- dates -----------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function formatDateLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const that = new Date(d);
  that.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today - that) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return DAYS[d.getDay()];
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatFullDate(iso) {
  const d = new Date(iso);
  return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTimeOfDay(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// --- training math ---------------------------------------------------------

/**
 * Estimated one-rep max (Epley). Returns 0 for bodyweight/empty sets so that
 * unloaded work never registers as a strength PR.
 */
export function estimateOneRepMax(weightKg, reps) {
  if (!weightKg || !reps || reps < 1) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Total load moved by the completed sets of one exercise. */
export function exerciseVolume(workoutExercise) {
  return (workoutExercise.sets || [])
    .filter((s) => s.isComplete && !s.isWarmup)
    .reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export function workoutVolume(workout) {
  return (workout.exercises || []).reduce((sum, we) => sum + exerciseVolume(we), 0);
}

export function workoutSetCount(workout) {
  return (workout.exercises || []).reduce(
    (sum, we) => sum + (we.sets || []).filter((s) => s.isComplete && !s.isWarmup).length,
    0,
  );
}

/**
 * Best-ever marks per exercise id across a list of finished workouts.
 * Returns { [exerciseId]: { bestWeight, bestOneRm, bestVolume, bestReps } }.
 */
export function buildPersonalRecords(workouts) {
  const prs = {};
  workouts.forEach((w) => {
    (w.exercises || []).forEach((we) => {
      const id = we.exerciseId;
      if (!prs[id]) {
        prs[id] = { bestWeight: 0, bestOneRm: 0, bestVolume: 0, bestReps: 0 };
      }
      const rec = prs[id];
      let sessionVolume = 0;

      (we.sets || []).forEach((s) => {
        if (!s.isComplete || s.isWarmup) return;
        sessionVolume += s.weightKg * s.reps;
        if (s.weightKg > rec.bestWeight) rec.bestWeight = s.weightKg;
        if (s.reps > rec.bestReps) rec.bestReps = s.reps;
        const orm = estimateOneRepMax(s.weightKg, s.reps);
        if (orm > rec.bestOneRm) rec.bestOneRm = orm;
      });

      if (sessionVolume > rec.bestVolume) rec.bestVolume = sessionVolume;
    });
  });
  return prs;
}

/**
 * Per-exercise session history, newest first:
 * [{ workoutId, date, sets, topWeight, topOneRm, volume }]
 */
export function buildExerciseHistory(workouts, exerciseId) {
  return workouts
    .map((w) => {
      const we = (w.exercises || []).find((e) => e.exerciseId === exerciseId);
      if (!we) return null;
      const sets = (we.sets || []).filter((s) => s.isComplete && !s.isWarmup);
      if (sets.length === 0) return null;
      return {
        workoutId: w.id,
        date: w.startedAt,
        sets,
        topWeight: Math.max(...sets.map((s) => s.weightKg)),
        topOneRm: Math.max(...sets.map((s) => estimateOneRepMax(s.weightKg, s.reps))),
        volume: sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/**
 * The most recent completed sets for an exercise, used to show the
 * "previous" ghost values while logging.
 */
export function lastPerformance(workouts, exerciseId, excludeWorkoutId) {
  const history = buildExerciseHistory(
    workouts.filter((w) => w.id !== excludeWorkoutId),
    exerciseId,
  );
  return history.length > 0 ? history[0] : null;
}
