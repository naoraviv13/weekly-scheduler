import { useState } from 'react';
import { Plus, X, Check, Trash2, Flag, MoreVertical } from 'lucide-react';
import { Sheet, MuscleChip } from './ui';
import * as db from '../supabaseData';
import { trimNum, estimateOneRepMax } from '../lib/training';

const GRID = 'grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_36px]';

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
      className={`grid ${GRID} items-center gap-1.5 rounded-lg px-1 py-1 transition ${
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

/**
 * One exercise block with its editable sets. Works for both an in-progress
 * session and a finished one; `onRestStart` is simply omitted for history.
 */
export function ExerciseBlock({
  workoutExercise,
  previousSession,
  prRecord,
  onMutate,
  onRestStart,
  onRemove,
}) {
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
    if (String(setId).startsWith('tmp-')) return;
    try {
      await db.updateSet(setId, patch);
    } catch (err) {
      console.error('Update set failed:', err);
    }
  };

  const completeSet = async (setId, isComplete) => {
    await updateSet(setId, { isComplete });
    if (isComplete && onRestStart) onRestStart();
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
      // On a finished workout a new set is logged as already done, otherwise
      // it would silently drop out of the volume and PR totals.
      isComplete: !onRestStart,
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
      const final = seed.isComplete ? await db.updateSet(saved.id, { isComplete: true }) : saved;
      onMutate((w) => ({
        ...w,
        exercises: w.exercises.map((e) =>
          e.id !== we.id
            ? e
            : { ...e, sets: e.sets.map((s) => (s.id === optimisticId ? final : s)) },
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

      <div className={`grid ${GRID} gap-1.5 px-1 pb-1`}>
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
