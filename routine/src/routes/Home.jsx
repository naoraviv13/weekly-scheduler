import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Play, Dumbbell, Scale, Flame, Plus, ChevronRight } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { SectionHeader, StatTile, EmptyState, Sheet } from '../components/ui';
import {
  workoutVolume,
  workoutSetCount,
  formatVolume,
  formatDateLabel,
  formatDuration,
  elapsedSeconds,
  trimNum,
} from '../lib/training';
import { dateKey } from '../supabaseData';

function WeightPrompt() {
  const { weightEntries, saveWeight } = useData();
  const today = dateKey(new Date());
  const todayEntry = weightEntries.find((w) => w.date === today);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);

  const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const previous = weightEntries.length > 1 ? weightEntries[weightEntries.length - 2] : null;
  const delta = latest && previous ? latest.weight - previous.weight : null;

  const submit = (e) => {
    e.preventDefault();
    const num = parseFloat(draft.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0 || num >= 500) return;
    saveWeight(today, Math.round(num * 100) / 100);
    setDraft('');
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => {
          setDraft(todayEntry ? String(todayEntry.weight) : '');
          setOpen(true);
        }}
        className="card flex w-full items-center gap-3 px-4 py-3 text-left transition hover:border-ink-600"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-400">
          <Scale size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="label-mono block">{todayEntry ? "Today's weight" : 'Log weight'}</span>
          <span className="mt-0.5 flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-bold tabular-nums">
              {todayEntry ? trimNum(todayEntry.weight) : '—'}
            </span>
            <span className="text-xs text-fog-400">kg</span>
            {delta !== null && delta !== 0 && (
              <span
                className={`font-mono text-xs ${delta > 0 ? 'text-flame-400' : 'text-mint-400'}`}
              >
                {delta > 0 ? '+' : ''}
                {trimNum(delta)}
              </span>
            )}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-fog-400" />
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Log body weight"
        subtitle={formatDateLabel(new Date().toISOString())}
        maxWidth="max-w-sm"
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <input
              className="field w-full text-center font-mono text-2xl font-bold tabular-nums"
              type="number"
              step="0.1"
              inputMode="decimal"
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="0.0"
            />
            <span className="text-sm text-fog-400">kg</span>
          </div>
          <button type="submit" className="btn-volt w-full">
            Save
          </button>
        </form>
      </Sheet>
    </>
  );
}

export default function HomeRoute() {
  const { routines, history, activeWorkout, beginWorkout } = useData();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);
  // Captured once per mount: calling Date.now() during render is impure.
  const [nowMs] = useState(() => Date.now());

  const weekStats = useMemo(() => {
    const cutoff = nowMs - 7 * 86400000;
    const recent = history.filter((w) => new Date(w.startedAt).getTime() >= cutoff);
    return {
      sessions: recent.length,
      volume: recent.reduce((sum, w) => sum + workoutVolume(w), 0),
      sets: recent.reduce((sum, w) => sum + workoutSetCount(w), 0),
    };
  }, [history, nowMs]);

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
      console.error('Start workout failed:', e);
      setStarting(false);
    }
  };

  const recent = history.slice(0, 5);

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {activeWorkout ? 'Session in progress' : 'Ready to train?'}
        </h1>
        <p className="mt-1 text-sm text-fog-400">
          {activeWorkout
            ? `${activeWorkout.name} · ${formatDuration(elapsedSeconds(activeWorkout.startedAt))} elapsed`
            : 'Start empty, or pick one of your routines.'}
        </p>

        <div className="mt-3 flex gap-2">
          {activeWorkout ? (
            <Link to="/workout" className="btn-volt flex-1 text-center">
              Resume workout
            </Link>
          ) : (
            <button onClick={() => start(null)} disabled={starting} className="btn-volt flex-1">
              <span className="inline-flex items-center justify-center gap-1.5">
                <Play size={16} /> Start empty workout
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-2">
        <StatTile label="7d sessions" value={weekStats.sessions} accent />
        <StatTile label="7d volume" value={formatVolume(weekStats.volume)} unit="kg" />
        <StatTile label="7d sets" value={weekStats.sets} />
      </section>

      <section>
        <WeightPrompt />
      </section>

      <section>
        <SectionHeader
          action={
            <Link to="/routines" className="text-xs font-medium text-volt-300">
              All
            </Link>
          }
        >
          Your routines
        </SectionHeader>

        {routines.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Dumbbell}
              title="No routines yet"
              body="Build a reusable routine so you can start a session in one tap."
              action={
                <Link to="/routines/new" className="btn-volt">
                  <span className="inline-flex items-center gap-1.5">
                    <Plus size={16} /> New routine
                  </span>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {routines.slice(0, 4).map((r) => (
              <div
                key={r.id}
                className="card flex items-center gap-3 px-4 py-3 transition hover:border-ink-600"
              >
                <Link to={`/routines/${r.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.name}</p>
                  <p className="mt-0.5 truncate text-xs text-fog-400">
                    {r.exercises.length === 0
                      ? 'No exercises'
                      : r.exercises
                          .slice(0, 3)
                          .map((e) => e.exercise?.name)
                          .filter(Boolean)
                          .join(' · ')}
                    {r.exercises.length > 3 ? ` +${r.exercises.length - 3}` : ''}
                  </p>
                </Link>
                <button
                  onClick={() => start(r)}
                  disabled={starting}
                  className="btn-volt shrink-0 px-3 py-2 text-sm"
                  aria-label={`Start ${r.name}`}
                >
                  <Play size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionHeader
          action={
            <Link to="/progress" className="text-xs font-medium text-volt-300">
              History
            </Link>
          }
        >
          Recent sessions
        </SectionHeader>

        {recent.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Flame}
              title="No sessions logged"
              body="Your finished workouts will show up here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((w) => (
              <Link
                key={w.id}
                to={`/workout/${w.id}`}
                className="card flex items-center gap-3 px-4 py-3 transition hover:border-ink-600"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{w.name}</p>
                  <p className="mt-0.5 text-xs text-fog-400">
                    {formatDateLabel(w.startedAt)} · {workoutSetCount(w)} sets ·{' '}
                    {formatVolume(workoutVolume(w))} kg
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-fog-400" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
