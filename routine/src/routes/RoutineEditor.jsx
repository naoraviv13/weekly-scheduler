import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, X, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { MuscleChip, EmptyState } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';

export default function RoutineEditorRoute() {
  const { id } = useParams();
  const isNew = id === 'new';
  const { routines } = useData();
  const navigate = useNavigate();

  const existing = useMemo(() => routines.find((r) => r.id === id), [routines, id]);

  if (!isNew && !existing) {
    return (
      <EmptyState
        title="Routine not found"
        body="It may have been deleted."
        action={
          <button onClick={() => navigate('/routines')} className="btn-volt">
            Back to routines
          </button>
        }
      />
    );
  }

  // Keyed by id so switching routines remounts the form with fresh initial
  // state instead of syncing props into state from an effect.
  return <RoutineForm key={id} routineId={isNew ? null : id} existing={existing} />;
}

function RoutineForm({ routineId, existing }) {
  const { routines, exerciseById, saveRoutine } = useData();
  const navigate = useNavigate();

  const [name, setName] = useState(existing?.name || '');
  const [notes, setNotes] = useState(existing?.notes || '');
  const [items, setItems] = useState(() =>
    (existing?.exercises || []).map((e) => ({
      exerciseId: e.exerciseId,
      targetSets: e.targetSets,
      notes: e.notes || '',
    })),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isNew = !routineId;
  const addExercises = (ids) => {
    setItems((prev) => [
      ...prev,
      ...ids
        .filter((exId) => !prev.some((p) => p.exerciseId === exId))
        .map((exId) => ({ exerciseId: exId, targetSets: 3, notes: '' })),
    ]);
  };

  const move = (index, delta) => {
    setItems((prev) => {
      const next = prev.slice();
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const setTargetSets = (index, value) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === index ? { ...it, targetSets: Math.max(1, Math.min(20, value)) } : it,
      ),
    );
  };

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await saveRoutine({
        id: routineId || undefined,
        name: name.trim(),
        notes: notes.trim() || null,
        sortOrder: existing?.sortOrder ?? routines.length,
        exercises: items,
      });
      navigate('/routines');
    } catch (e) {
      console.error('Save routine failed:', e);
      setError(e.message || 'Could not save the routine.');
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {isNew ? 'New routine' : 'Edit routine'}
      </h1>

      <div>
        <label className="label-mono mb-1.5 block">Name</label>
        <input
          className="field w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Push Day A"
          autoFocus={isNew}
        />
      </div>

      <div>
        <label className="label-mono mb-1.5 block">Notes (optional)</label>
        <textarea
          className="field min-h-16 w-full resize-y"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Focus, tempo, anything to remember"
        />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="label-mono">Exercises ({items.length})</span>
          <button onClick={() => setPickerOpen(true)} className="text-xs font-medium text-volt-300">
            + Add
          </button>
        </div>

        {items.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Plus}
              title="No exercises yet"
              body="Add the movements you want in this routine."
              action={
                <button onClick={() => setPickerOpen(true)} className="btn-volt">
                  Add exercise
                </button>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {items.map((item, i) => {
              const ex = exerciseById[item.exerciseId];
              return (
                <div key={item.exerciseId} className="card flex items-center gap-2 px-3 py-2.5">
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-fog-400 transition hover:text-fog-100 disabled:opacity-25"
                      aria-label="Move up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === items.length - 1}
                      className="rounded p-0.5 text-fog-400 transition hover:text-fog-100 disabled:opacity-25"
                      aria-label="Move down"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{ex?.name || 'Unknown exercise'}</p>
                    {ex && (
                      <div className="mt-1">
                        <MuscleChip group={ex.muscleGroup} />
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setTargetSets(i, item.targetSets - 1)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 text-fog-300 transition hover:bg-ink-700"
                      aria-label="Fewer sets"
                    >
                      <Minus size={13} />
                    </button>
                    <span className="w-10 text-center font-mono text-sm tabular-nums">
                      {item.targetSets}
                    </span>
                    <button
                      onClick={() => setTargetSets(i, item.targetSets + 1)}
                      className="grid h-7 w-7 place-items-center rounded-md bg-ink-800 text-fog-300 transition hover:bg-ink-700"
                      aria-label="More sets"
                    >
                      <Plus size={13} />
                    </button>
                  </div>

                  <button
                    onClick={() => setItems((prev) => prev.filter((_, idx) => idx !== i))}
                    className="shrink-0 rounded-md p-1 text-fog-400 transition hover:text-flame-400"
                    aria-label={`Remove ${ex?.name}`}
                  >
                    <X size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-flame-400/10 px-3 py-2 text-sm text-flame-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button onClick={() => navigate('/routines')} className="btn-ghost flex-1">
          Cancel
        </button>
        <button onClick={submit} disabled={!name.trim() || saving} className="btn-volt flex-1">
          {saving ? 'Saving…' : 'Save routine'}
        </button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercises}
        multi
      />
    </div>
  );
}
