import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Layers, Pencil, Plus, Check } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { EmptyState, MuscleChip, StatTile, Sheet } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseBlock } from '../components/WorkoutEditor';
import * as db from '../supabaseData';
import {
  formatFullDate,
  formatTimeOfDay,
  formatDuration,
  elapsedSeconds,
  workoutVolume,
  workoutSetCount,
  formatVolume,
  trimNum,
  estimateOneRepMax,
  lastPerformance,
} from '../lib/training';

/** `datetime-local` wants YYYY-MM-DDTHH:mm in local time, not an ISO string. */
function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function WorkoutDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    history,
    removeWorkout,
    editWorkout,
    patchHistoryWorkout,
    personalRecords,
    exerciseById,
  } = useData();

  const [confirm, setConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draft, setDraft] = useState({ name: '', notes: '', startedAt: '' });

  const workout = useMemo(() => history.find((w) => w.id === id), [history, id]);

  if (!workout) {
    return (
      <EmptyState
        title="Workout not found"
        body="It may have been deleted, or be older than your loaded history."
        action={
          <button onClick={() => navigate('/progress')} className="btn-volt">
            Back to history
          </button>
        }
      />
    );
  }

  const duration = workout.endedAt ? elapsedSeconds(workout.startedAt, workout.endedAt) : 0;

  const openDetails = () => {
    setDraft({
      name: workout.name,
      notes: workout.notes || '',
      startedAt: toLocalInput(workout.startedAt),
    });
    setDetailsOpen(true);
  };

  const saveDetails = async (e) => {
    e.preventDefault();
    if (!draft.name.trim()) return;

    const patch = { name: draft.name.trim(), notes: draft.notes.trim() || null };

    // Keep the recorded duration intact when the start time is moved.
    const nextStart = new Date(draft.startedAt);
    if (!Number.isNaN(nextStart.getTime())) {
      const prevStart = new Date(workout.startedAt).getTime();
      if (nextStart.getTime() !== prevStart) {
        patch.startedAt = nextStart.toISOString();
        if (workout.endedAt) {
          patch.endedAt = new Date(nextStart.getTime() + duration * 1000).toISOString();
        }
      }
    }

    await editWorkout(workout.id, patch);
    setDetailsOpen(false);
  };

  const mutate = (updater) => patchHistoryWorkout(workout.id, updater);

  const addExercises = async (ids) => {
    const base = workout.exercises.length;
    for (let i = 0; i < ids.length; i++) {
      try {
        const saved = await db.addWorkoutExercise(workout.id, ids[i], base + i);
        const withExercise = { ...saved, exercise: saved.exercise || exerciseById[ids[i]] };
        mutate((w) => ({ ...w, exercises: [...w.exercises, withExercise] }));
      } catch (e) {
        console.error('Add exercise failed:', e);
      }
    }
  };

  const removeExercise = async (weId) => {
    mutate((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== weId) }));
    try {
      await db.removeWorkoutExercise(weId);
    } catch (e) {
      console.error('Remove exercise failed:', e);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Link to="/progress" className="inline-flex items-center gap-1.5 text-sm text-fog-400">
        <ArrowLeft size={16} /> History
      </Link>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{workout.name}</h1>
          <p className="mt-1 text-sm text-fog-400">
            {formatFullDate(workout.startedAt)} · {formatTimeOfDay(workout.startedAt)}
          </p>
        </div>
        <button onClick={openDetails} className="btn-ghost shrink-0 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Pencil size={14} /> Details
          </span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Duration" value={formatDuration(duration)} />
        <StatTile label="Volume" value={formatVolume(workoutVolume(workout))} unit="kg" accent />
        <StatTile label="Sets" value={workoutSetCount(workout)} />
      </div>

      {workout.notes && (
        <div className="card px-4 py-3">
          <p className="label-mono mb-1">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-fog-300">{workout.notes}</p>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="label-mono">Exercises</span>
        <button
          onClick={() => setEditing(!editing)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            editing ? 'bg-volt-300 text-ink-950' : 'bg-ink-800 text-fog-300 hover:bg-ink-700'
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            {editing ? <Check size={13} /> : <Pencil size={13} />}
            {editing ? 'Done' : 'Edit sets'}
          </span>
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {workout.exercises.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Layers}
              title="No exercises logged"
              body={editing ? 'Add one below.' : 'Tap "Edit sets" to add one.'}
            />
          </div>
        ) : editing ? (
          workout.exercises.map((we) => (
            <ExerciseBlock
              key={we.id}
              workoutExercise={we}
              previousSession={lastPerformance(history, we.exerciseId, workout.id)}
              prRecord={personalRecords[we.exerciseId]}
              onMutate={mutate}
              onRemove={() => removeExercise(we.id)}
            />
          ))
        ) : (
          workout.exercises.map((we) => {
            const done = we.sets.filter((s) => s.isComplete && !s.isWarmup);
            const best = done.reduce(
              (m, s) => Math.max(m, estimateOneRepMax(s.weightKg, s.reps)),
              0,
            );
            return (
              <div key={we.id} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/exercises/${we.exerciseId}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{we.exercise?.name || 'Exercise'}</p>
                    {we.exercise && (
                      <div className="mt-1">
                        <MuscleChip group={we.exercise.muscleGroup} />
                      </div>
                    )}
                  </Link>
                  {best > 0 && (
                    <div className="shrink-0 text-right">
                      <p className="label-mono">Est. 1RM</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
                        {trimNum(Math.round(best))}
                      </p>
                    </div>
                  )}
                </div>

                {done.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-700 pt-2">
                    {done.map((s, i) => (
                      <span
                        key={s.id || i}
                        className="rounded-md bg-ink-800 px-2 py-1 font-mono text-[11px] tabular-nums text-fog-300"
                      >
                        {trimNum(s.weightKg)}×{s.reps}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <button onClick={() => setPickerOpen(true)} className="btn-ghost w-full">
          <span className="inline-flex items-center justify-center gap-1.5">
            <Plus size={16} /> Add exercise
          </span>
        </button>
      )}

      <button onClick={() => setConfirm(true)} className="btn-danger w-full">
        <span className="inline-flex items-center justify-center gap-1.5">
          <Trash2 size={16} /> Delete workout
        </span>
      </button>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercises}
        multi
      />

      <Sheet
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title="Edit workout"
        maxWidth="max-w-sm"
      >
        <form onSubmit={saveDetails} className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block" htmlFor="w-name">
              Name
            </label>
            <input
              id="w-name"
              className="field w-full"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div>
            <label className="label-mono mb-1.5 block" htmlFor="w-date">
              Date &amp; time
            </label>
            <input
              id="w-date"
              className="field w-full"
              type="datetime-local"
              value={draft.startedAt}
              onChange={(e) => setDraft({ ...draft, startedAt: e.target.value })}
            />
            <p className="mt-1 text-[11px] text-fog-400">
              Duration ({formatDuration(duration)}) is preserved.
            </p>
          </div>

          <div>
            <label className="label-mono mb-1.5 block" htmlFor="w-notes">
              Notes
            </label>
            <textarea
              id="w-notes"
              className="field min-h-20 w-full resize-y"
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              placeholder="How did it feel?"
            />
          </div>

          <button type="submit" disabled={!draft.name.trim()} className="btn-volt w-full">
            Save changes
          </button>
        </form>
      </Sheet>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this workout?"
        subtitle="The session and all its sets are removed permanently."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              removeWorkout(workout.id);
              navigate('/progress');
            }}
            className="btn-danger w-full"
          >
            Yes, delete
          </button>
          <button onClick={() => setConfirm(false)} className="btn-ghost w-full">
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  );
}
