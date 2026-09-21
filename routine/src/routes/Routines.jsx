import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Play, Dumbbell, Pencil, Trash2 } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { EmptyState, Sheet, MuscleChip } from '../components/ui';

export default function RoutinesRoute() {
  const { routines, removeRoutine, beginWorkout, activeWorkout } = useData();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [starting, setStarting] = useState(false);

  const start = async (routine) => {
    if (activeWorkout) {
      navigate('/workout');
      return;
    }
    setStarting(true);
    try {
      await beginWorkout({ routine });
      navigate('/workout');
    } catch (e) {
      console.error('Start failed:', e);
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Routines</h1>
        <Link to="/routines/new" className="btn-volt px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> New
          </span>
        </Link>
      </div>

      {routines.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Dumbbell}
            title="No routines yet"
            body="A routine is a reusable list of exercises — build one once, start it in a tap."
            action={
              <Link to="/routines/new" className="btn-volt">
                Create your first routine
              </Link>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {routines.map((r) => {
            const groups = [
              ...new Set(r.exercises.map((e) => e.exercise?.muscleGroup).filter(Boolean)),
            ];
            return (
              <div key={r.id} className="card px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{r.name}</p>
                    <p className="mt-0.5 text-xs text-fog-400">
                      {r.exercises.length} exercise{r.exercises.length === 1 ? '' : 's'}
                    </p>
                    {groups.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {groups.map((g) => (
                          <MuscleChip key={g} group={g} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => start(r)}
                    disabled={starting}
                    className="btn-volt shrink-0 px-3 py-2 text-sm"
                    aria-label={`Start ${r.name}`}
                  >
                    <Play size={14} />
                  </button>
                </div>

                {r.exercises.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-0.5 border-t border-ink-700 pt-2">
                    {r.exercises.slice(0, 5).map((e) => (
                      <li key={e.id} className="flex justify-between text-xs text-fog-300">
                        <span className="truncate">{e.exercise?.name}</span>
                        <span className="ml-2 shrink-0 font-mono text-fog-400">
                          {e.targetSets} × sets
                        </span>
                      </li>
                    ))}
                    {r.exercises.length > 5 && (
                      <li className="text-xs text-fog-400">+{r.exercises.length - 5} more</li>
                    )}
                  </ul>
                )}

                <div className="mt-3 flex gap-2">
                  <Link to={`/routines/${r.id}`} className="btn-ghost flex-1 py-2 text-center text-sm">
                    <span className="inline-flex items-center justify-center gap-1.5">
                      <Pencil size={14} /> Edit
                    </span>
                  </Link>
                  <button
                    onClick={() => setConfirmDelete(r)}
                    className="btn-danger px-3 py-2 text-sm"
                    aria-label={`Delete ${r.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name}"?`}
        subtitle="Workouts already logged from it are kept."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              removeRoutine(confirmDelete.id);
              setConfirmDelete(null);
            }}
            className="btn-danger w-full"
          >
            Delete routine
          </button>
          <button onClick={() => setConfirmDelete(null)} className="btn-ghost w-full">
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  );
}
