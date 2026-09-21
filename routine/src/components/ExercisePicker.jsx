import { useMemo, useState } from 'react';
import { Search, Plus, Check } from 'lucide-react';
import { Sheet, MuscleChip, EmptyState } from './ui';
import { MUSCLE_GROUPS, EQUIPMENT } from '../lib/training';
import { useData } from '../lib/dataContext';

/**
 * Searchable exercise picker. `multi` returns an array of ids on confirm,
 * single mode fires onPick immediately.
 */
export function ExercisePicker({ open, onClose, onPick, multi = false, title = 'Add exercise' }) {
  const { exercises, createExercise } = useData();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [equipment, setEquipment] = useState('all');
  const [selected, setSelected] = useState([]);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', muscleGroup: 'chest', equipment: 'barbell' });
  const [error, setError] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (group !== 'all' && e.muscleGroup !== group) return false;
      if (equipment !== 'all' && e.equipment !== equipment) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, group, equipment]);

  const reset = () => {
    setQuery('');
    setGroup('all');
    setEquipment('all');
    setSelected([]);
    setCreating(false);
    setError(null);
    setDraft({ name: '', muscleGroup: 'chest', equipment: 'barbell' });
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggle = (id) => {
    if (!multi) {
      onPick([id]);
      close();
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const confirm = () => {
    if (selected.length === 0) return;
    onPick(selected);
    close();
  };

  const submitNew = async (e) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setError(null);
    try {
      const saved = await createExercise({ ...draft, name });
      setCreating(false);
      setDraft({ name: '', muscleGroup: 'chest', equipment: 'barbell' });
      toggle(saved.id);
    } catch (err) {
      setError(
        err?.code === '23505'
          ? 'You already have an exercise with that name.'
          : err?.message || 'Could not create exercise.',
      );
    }
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={creating ? 'New exercise' : title}
      subtitle={creating ? 'Add something the library is missing' : undefined}
    >
      {creating ? (
        <form onSubmit={submitNew} className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block">Name</label>
            <input
              className="field w-full"
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Incline Machine Press"
            />
          </div>

          <div>
            <label className="label-mono mb-1.5 block">Muscle group</label>
            <div className="flex flex-wrap gap-1.5">
              {MUSCLE_GROUPS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDraft({ ...draft, muscleGroup: g })}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                    draft.muscleGroup === g
                      ? 'bg-volt-300 text-ink-950'
                      : 'bg-ink-800 text-fog-300 hover:bg-ink-700'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label-mono mb-1.5 block">Equipment</label>
            <div className="flex flex-wrap gap-1.5">
              {EQUIPMENT.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => setDraft({ ...draft, equipment: eq })}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                    draft.equipment === eq
                      ? 'bg-volt-300 text-ink-950'
                      : 'bg-ink-800 text-fog-300 hover:bg-ink-700'
                  }`}
                >
                  {eq}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-flame-400/10 px-3 py-2 text-sm text-flame-400">{error}</p>
          )}

          <div className="mt-1 flex gap-2">
            <button type="button" onClick={() => setCreating(false)} className="btn-ghost flex-1">
              Back
            </button>
            <button type="submit" disabled={!draft.name.trim()} className="btn-volt flex-1">
              Create
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-400"
            />
            <input
              className="field w-full pl-9"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises"
            />
          </div>

          <div className="-mx-5 mb-2 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {['all', ...MUSCLE_GROUPS].map((g) => (
              <button
                key={g}
                onClick={() => setGroup(g)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${
                  group === g
                    ? 'bg-volt-300 text-ink-950'
                    : 'bg-ink-800 text-fog-300 hover:bg-ink-700'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          <div className="-mx-5 mb-3 flex gap-1.5 overflow-x-auto px-5 pb-1">
            {['all', ...EQUIPMENT].map((eq) => (
              <button
                key={eq}
                onClick={() => setEquipment(eq)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium capitalize transition ${
                  equipment === eq
                    ? 'bg-sky-400/20 text-sky-400 ring-1 ring-sky-400/40'
                    : 'bg-ink-800/60 text-fog-400 hover:bg-ink-700'
                }`}
              >
                {eq === 'all' ? 'any equipment' : eq}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            {filtered.length === 0 ? (
              <EmptyState title="No matches" body="Try a different search or create a new exercise." />
            ) : (
              filtered.map((ex) => {
                const isSelected = selected.includes(ex.id);
                return (
                  <button
                    key={ex.id}
                    onClick={() => toggle(ex.id)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                      isSelected ? 'bg-volt-300/10' : 'hover:bg-ink-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{ex.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <MuscleChip group={ex.muscleGroup} />
                        <span className="text-[11px] capitalize text-fog-400">{ex.equipment}</span>
                        {ex.isCustom && (
                          <span className="text-[11px] text-volt-400">custom</span>
                        )}
                      </div>
                    </div>
                    {multi && (
                      <span
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${
                          isSelected
                            ? 'border-volt-300 bg-volt-300 text-ink-950'
                            : 'border-ink-600'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="sticky bottom-0 -mx-5 mt-3 flex gap-2 border-t border-ink-700 bg-ink-900/95 px-5 py-3 backdrop-blur">
            <button onClick={() => setCreating(true)} className="btn-ghost flex-1">
              <span className="inline-flex items-center justify-center gap-1.5">
                <Plus size={16} /> New
              </span>
            </button>
            {multi && (
              <button onClick={confirm} disabled={selected.length === 0} className="btn-volt flex-1">
                Add {selected.length > 0 ? selected.length : ''}
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
