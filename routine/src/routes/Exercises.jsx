import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Library } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { MuscleChip, EmptyState, Sheet } from '../components/ui';
import { MUSCLE_GROUPS, EQUIPMENT, trimNum } from '../lib/training';

export default function ExercisesRoute() {
  const { exercises, personalRecords, createExercise } = useData();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('all');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', muscleGroup: 'chest', equipment: 'barbell' });
  const [error, setError] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exercises.filter((e) => {
      if (group !== 'all' && e.muscleGroup !== group) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [exercises, query, group]);

  const submitNew = async (e) => {
    e.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    setError(null);
    try {
      await createExercise({ ...draft, name });
      setCreating(false);
      setDraft({ name: '', muscleGroup: 'chest', equipment: 'barbell' });
    } catch (err) {
      setError(
        err?.code === '23505'
          ? 'You already have an exercise with that name.'
          : err?.message || 'Could not create exercise.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Exercises</h1>
        <button onClick={() => setCreating(true)} className="btn-volt px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> New
          </span>
        </button>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fog-400"
        />
        <input
          className="field w-full pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises"
        />
      </div>

      <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {['all', ...MUSCLE_GROUPS].map((g) => (
          <button
            key={g}
            onClick={() => setGroup(g)}
            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium capitalize transition ${
              group === g ? 'bg-volt-300 text-ink-950' : 'bg-ink-800 text-fog-300 hover:bg-ink-700'
            }`}
          >
            {g}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Library}
            title="Nothing here"
            body="Try another filter, or add a custom exercise."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((ex) => {
            const pr = personalRecords[ex.id];
            return (
              <Link
                key={ex.id}
                to={`/exercises/${ex.id}`}
                className="card flex items-center gap-3 px-4 py-3 transition hover:border-ink-600"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{ex.name}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <MuscleChip group={ex.muscleGroup} />
                    <span className="text-[11px] capitalize text-fog-400">{ex.equipment}</span>
                    {ex.isCustom && <span className="text-[11px] text-volt-400">custom</span>}
                  </div>
                </div>
                {pr?.bestWeight > 0 && (
                  <div className="shrink-0 text-right">
                    <p className="label-mono">Best</p>
                    <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
                      {trimNum(pr.bestWeight)}
                      <span className="text-[10px] text-fog-400"> kg</span>
                    </p>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="New exercise"
        subtitle="Add something the library is missing"
        maxWidth="max-w-sm"
      >
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

          <button type="submit" disabled={!draft.name.trim()} className="btn-volt w-full">
            Create exercise
          </button>
        </form>
      </Sheet>
    </div>
  );
}
