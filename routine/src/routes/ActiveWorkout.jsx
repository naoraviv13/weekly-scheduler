import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Check, Trash2, Flag, MoreVertical } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { Sheet, MuscleChip, EmptyState } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { RestTimer, RestDurationPicker } from '../components/RestTimer';
import { useRestTimer } from '../lib/useRestTimer';
import * as db from '../supabaseData';
import {
  elapsedSeconds,
  formatDuration,
  workoutVolume,
  workoutSetCount,
  formatVolume,
  lastPerformance,
  trimNum,
  estimateOneRepMax,
} from '../lib/training';

/** One editable set row. Remounted by `key={set.id}` when the row is replaced. */
function SetRow({ set, index, previous, onChange, onComplete, onDelete, isPr }) {
  const [weight, setWeight] = useState(set.weightKg ? String(set.weightKg) : '');
  const [reps, setReps] = useState(set.reps ? String(set.reps) : '');

  const commit = (nextWeight, nextReps) => {
    const w = parseFloat(String(nextWeight).replace(',', '.'));
    const r = parseInt(nextReps, 10);
    onChange({
      weightKg: Number.isNaN(w) ? 0 : w,
      reps: Number.isNaN(r) ? 0 : r,
    });
  };

  const canComplete = (parseFloat(weight) > 0 || parseInt(reps, 10) > 0) && !set.isComplete;
  const prevLabel = previous ? `${trimNum(previous.weightKg)}×${previous.reps}` : '—';

  return (
    <div
      className={`grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-1.5 rounded-lg px-1 py-1 transition ${
        set.isComplete ? 'bg-volt-300/8' : ''
      }`}
    >
      <span
        className={`text-center font-mono text-xs font-medium ${
          set.isWarmup ? 'text-sky-400' : 'text-fog-400'
        }`}
      >
        {set.isWarmup ? 'W' : index + 1}
      </span>

      <span className="truncate text-center font-mono text-[11px] text-fog-400">{prevLabel}</span>

      <input
        className="field w-full px-1.5 py-1.5 text-center font-mono text-sm tabular-nums"
        type="number"
        step="0.5"
        inputMode="decimal"
        value={weight}
        placeholder="0"
        onChange={(e) => setWeight(e.target.value)}
        onBlur={() => commit(weight, reps)}
        aria-label={`Set ${index + 1} weight in kg`}
      />

      <input
        className="field w-full px-1.5 py-1.5 text-center font-mono text-sm tabular-nums"
        type="number"
        inputMode="numeric"
        value={reps}
        placeholder="0"
        onChange={(e) => setReps(e.target.value)}
        onBlur={() => commit(weight, reps)}
        aria-label={`Set ${index + 1} reps`}
      />

      <div className="flex items-center justify-end gap-0.5">
        {isPr && set.isComplete && (
          <span title="Personal record" className="text-volt-300">
            <Flag size={11} />
          </span>
        )}
        <button
          onClick={() => {
            commit(weight, reps);
            onComplete(!set.isComplete);
          }}
          disabled={!canComplete && !set.isComplete}
          className={`grid h-7 w-7 place-items-center rounded-md border transition active:scale-95 ${
            set.isComplete
              ? 'border-volt-300 bg-volt-300 text-ink-950'
              : 'border-ink-600 text-fog-400 disabled:opacity-30'
          }`}
          aria-label={set.isComplete ? 'Mark set incomplete' : 'Complete set'}
        >
          <Check size={14} strokeWidth={3} />
        </button>
        <button
          onClick={onDelete}
          className="grid h-7 w-6 place-items-center rounded-md text-fog-400 transition hover:text-flame-400"
          aria-label={`Delete set ${index + 1}`}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
}

/** One exercise block inside the session. */
function ExerciseBlock({ workoutExercise, previousSession, prRecord, onMutate, onRestStart, onRemove }) {
  const we = workoutExercise;
  const ex = we.exercise;
  const [menuOpen, setMenuOpen] = useState(false);

  const updateSet = async (setId, patch) => {
    onMutate((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id !== we.id
          ? e
          : { ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) },
      ),
    }));
    try {
      await db.updateSet(setId, patch);
    } catch (err) {
      console.error('Update set failed:', err);
    }
  };

  const completeSet = async (setId, isComplete) => {
    await updateSet(setId, { isComplete });
    if (isComplete) onRestStart();
  };

  const addSet = async () => {
    const last = we.sets[we.sets.length - 1];
    const optimisticId = `tmp-${Date.now()}`;
    const nextIndex = we.sets.length;
    const seed = {
      id: optimisticId,
      setIndex: nextIndex,
      weightKg: last?.weightKg ?? 0,
      reps: last?.reps ?? 0,
      rpe: null,
      isWarmup: false,
      isComplete: false,
    };
    onMutate((w) => ({
      ...w,
      exercises: w.exercises.map((e) => (e.id === we.id ? { ...e, sets: [...e.sets, seed] } : e)),
    }));
    try {
      const saved = await db.addSet(we.id, {
        setIndex: nextIndex,
        weightKg: seed.weightKg,
        reps: seed.reps,
      });
      onMutate((w) => ({
        ...w,
        exercises: w.exercises.map((e) =>
          e.id !== we.id
            ? e
            : { ...e, sets: e.sets.map((s) => (s.id === optimisticId ? saved : s)) },
        ),
      }));
    } catch (err) {
      console.error('Add set failed:', err);
      onMutate((w) => ({
        ...w,
        exercises: w.exercises.map((e) =>
          e.id !== we.id ? e : { ...e, sets: e.sets.filter((s) => s.id !== optimisticId) },
        ),
      }));
    }
  };

  const deleteSet = async (setId) => {
    onMutate((w) => ({
      ...w,
      exercises: w.exercises.map((e) =>
        e.id !== we.id ? e : { ...e, sets: e.sets.filter((s) => s.id !== setId) },
      ),
    }));
    if (String(setId).startsWith('tmp-')) return;
    try {
      await db.deleteSet(setId);
    } catch (err) {
      console.error('Delete set failed:', err);
    }
  };

  const bestOneRm = prRecord?.bestOneRm || 0;

  return (
    <div className="card px-3 py-3">
      <div className="mb-2 flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{ex?.name || 'Exercise'}</p>
          <div className="mt-1 flex items-center gap-1.5">
            {ex && <MuscleChip group={ex.muscleGroup} />}
            {bestOneRm > 0 && (
              <span className="font-mono text-[10px] text-fog-400">
                PR ~{trimNum(Math.round(bestOneRm))}kg 1RM
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="-mr-1 rounded-lg p-1.5 text-fog-400 transition hover:bg-ink-800"
          aria-label={`Options for ${ex?.name}`}
        >
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_36px] gap-1.5 px-1 pb-1">
        <span className="label-mono text-center">Set</span>
        <span className="label-mono text-center">Prev</span>
        <span className="label-mono text-center">kg</span>
        <span className="label-mono text-center">Reps</span>
        <span />
      </div>

      <div className="flex flex-col gap-0.5">
        {we.sets.map((s, i) => {
          const orm = estimateOneRepMax(s.weightKg, s.reps);
          return (
            <SetRow
              key={s.id}
              set={s}
              index={i}
              previous={previousSession?.sets?.[i]}
              isPr={bestOneRm > 0 && orm > bestOneRm}
              onChange={(patch) => updateSet(s.id, patch)}
              onComplete={(v) => completeSet(s.id, v)}
              onDelete={() => deleteSet(s.id)}
            />
          );
        })}
      </div>

      <button
        onClick={addSet}
        className="mt-2 w-full rounded-lg border border-dashed border-ink-600 py-2 text-xs font-medium text-fog-400 transition hover:border-ink-500 hover:text-fog-100"
      >
        <span className="inline-flex items-center gap-1.5">
          <Plus size={14} /> Add set
        </span>
      </button>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={ex?.name || 'Exercise'}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              setMenuOpen(false);
              onRemove();
            }}
            className="btn-danger w-full"
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              <Trash2 size={16} /> Remove from workout
            </span>
          </button>
          <button onClick={() => setMenuOpen(false)} className="btn-ghost w-full">
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  );
}

export default function ActiveWorkoutRoute() {
  const {
    activeWorkout,
    patchActiveWorkout,
    endWorkout,
    discardWorkout,
    renameActiveWorkout,
    history,
    personalRecords,
    exerciseById,
  } = useData();
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useReducer((x) => x + 1, 0);

  const rest = useRestTimer(90);

  useEffect(() => {
    const id = setInterval(force, 1000);
    return () => clearInterval(id);
  }, []);

  const volume = useMemo(
    () => (activeWorkout ? workoutVolume(activeWorkout) : 0),
    [activeWorkout],
  );
  const setsDone = useMemo(
    () => (activeWorkout ? workoutSetCount(activeWorkout) : 0),
    [activeWorkout],
  );

  if (!activeWorkout) {
    return (
      <EmptyState
        title="No active workout"
        body="Start one from the home screen."
        action={
          <button onClick={() => navigate('/')} className="btn-volt">
            Go home
          </button>
        }
      />
    );
  }

  const addExercises = async (ids) => {
    const base = activeWorkout.exercises.length;
    for (let i = 0; i < ids.length; i++) {
      try {
        const saved = await db.addWorkoutExercise(activeWorkout.id, ids[i], base + i);
        const withExercise = { ...saved, exercise: saved.exercise || exerciseById[ids[i]] };
        patchActiveWorkout((w) => ({ ...w, exercises: [...w.exercises, withExercise] }));
      } catch (e) {
        console.error('Add exercise failed:', e);
      }
    }
  };

  const removeExercise = async (weId) => {
    patchActiveWorkout((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== weId) }));
    try {
      await db.removeWorkoutExercise(weId);
    } catch (e) {
      console.error('Remove exercise failed:', e);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await endWorkout(notes || undefined);
      navigate('/');
    } catch (e) {
      console.error('Finish failed:', e);
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await discardWorkout();
      navigate('/');
    } catch (e) {
      console.error('Discard failed:', e);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur-md">
        <input
          className="w-full bg-transparent text-xl font-extrabold tracking-tight outline-none"
          value={activeWorkout.name}
          onChange={(e) => renameActiveWorkout(e.target.value)}
          aria-label="Workout name"
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-sm font-bold tabular-nums text-volt-300">
            {formatDuration(elapsedSeconds(activeWorkout.startedAt))}
          </span>
          <span className="font-mono text-xs text-fog-400">
            {formatVolume(volume)} kg · {setsDone} sets
          </span>
          <div className="ml-auto">
            <RestDurationPicker duration={rest.duration} setDuration={rest.setDuration} />
          </div>
        </div>
      </div>

      {activeWorkout.exercises.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Plus}
            title="Empty session"
            body="Add your first exercise to start logging sets."
            action={
              <button onClick={() => setPickerOpen(true)} className="btn-volt">
                Add exercise
              </button>
            }
          />
        </div>
      ) : (
        activeWorkout.exercises.map((we) => (
          <ExerciseBlock
            key={we.id}
            workoutExercise={we}
            previousSession={lastPerformance(history, we.exerciseId, activeWorkout.id)}
            prRecord={personalRecords[we.exerciseId]}
            onMutate={patchActiveWorkout}
            onRestStart={() => rest.start()}
            onRemove={() => removeExercise(we.id)}
          />
        ))
      )}

      <div className="flex flex-col gap-2">
        <button onClick={() => setPickerOpen(true)} className="btn-ghost w-full">
          <span className="inline-flex items-center justify-center gap-1.5">
            <Plus size={16} /> Add exercise
          </span>
        </button>
        <button onClick={() => setFinishOpen(true)} className="btn-volt w-full">
          Finish workout
        </button>
        <button onClick={() => setDiscardOpen(true)} className="btn-danger w-full">
          Discard
        </button>
      </div>

      <RestTimer seconds={rest.remaining} onExtend={rest.extend} onSkip={rest.skip} />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercises}
        multi
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout"
        subtitle={`${formatVolume(volume)} kg across ${setsDone} sets`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block">Notes (optional)</label>
            <textarea
              className="field min-h-20 w-full resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
            />
          </div>
          <button onClick={finish} disabled={busy} className="btn-volt w-full">
            Save workout
          </button>
        </div>
      </Sheet>

      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard workout?"
        subtitle="This permanently deletes the session and its sets."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button onClick={discard} disabled={busy} className="btn-danger w-full">
            Yes, discard
          </button>
          <button onClick={() => setDiscardOpen(false)} className="btn-ghost w-full">
            Keep logging
          </button>
        </div>
      </Sheet>
    </div>
  );
}
