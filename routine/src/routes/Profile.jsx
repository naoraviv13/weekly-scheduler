import { useMemo, useState } from 'react';
import { LogOut, Dumbbell, Layers, Flame, Info } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useData } from '../lib/dataContext';
import { StatTile, SectionHeader, Sheet } from '../components/ui';
import {
  workoutVolume,
  workoutSetCount,
  formatVolume,
  formatDuration,
  elapsedSeconds,
  formatDateLabel,
} from '../lib/training';

export default function ProfileRoute() {
  const { history, exercises, routines } = useData();
  const [signingOut, setSigningOut] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const lifetime = useMemo(
    () => ({
      sessions: history.length,
      volume: history.reduce((s, w) => s + workoutVolume(w), 0),
      sets: history.reduce((s, w) => s + workoutSetCount(w), 0),
      time: history.reduce(
        (s, w) => s + (w.endedAt ? elapsedSeconds(w.startedAt, w.endedAt) : 0),
        0,
      ),
    }),
    [history],
  );

  /** Consecutive days back from today that contain at least one session. */
  const streak = useMemo(() => {
    if (history.length === 0) return 0;
    const dayKeys = new Set(
      history.map((w) => {
        const d = new Date(w.startedAt);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }),
    );
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    // Today not being a training day shouldn't break an otherwise live streak.
    if (!dayKeys.has(cursor.getTime())) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (dayKeys.has(cursor.getTime())) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [history]);

  const customCount = exercises.filter((e) => e.isCustom).length;
  const lastSession = history.length > 0 ? history[0] : null;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Sign out failed:', e);
      setSigningOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Profile</h1>

      <section>
        <SectionHeader>Lifetime</SectionHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label="Workouts" value={lifetime.sessions} accent />
          <StatTile label="Volume" value={formatVolume(lifetime.volume)} unit="kg" />
          <StatTile label="Sets" value={lifetime.sets} />
          <StatTile label="Time" value={formatDuration(lifetime.time)} />
        </div>
      </section>

      <section>
        <SectionHeader>Streak</SectionHeader>
        <div className="card flex items-center gap-3 px-4 py-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-volt-300/10 text-volt-300">
            <Flame size={22} />
          </span>
          <div>
            <p className="font-mono text-2xl font-bold tabular-nums text-volt-300">{streak}</p>
            <p className="text-xs text-fog-400">
              consecutive training {streak === 1 ? 'day' : 'days'}
              {lastSession ? ` · last ${formatDateLabel(lastSession.startedAt).toLowerCase()}` : ''}
            </p>
          </div>
        </div>
      </section>

      <section>
        <SectionHeader>Library</SectionHeader>
        <div className="flex flex-col gap-2">
          <div className="card flex items-center gap-3 px-4 py-3">
            <Layers size={18} className="shrink-0 text-fog-400" />
            <span className="flex-1 text-sm">Exercises</span>
            <span className="font-mono text-sm tabular-nums text-fog-300">
              {exercises.length}
              {customCount > 0 && (
                <span className="text-volt-400"> ({customCount} custom)</span>
              )}
            </span>
          </div>
          <div className="card flex items-center gap-3 px-4 py-3">
            <Dumbbell size={18} className="shrink-0 text-fog-400" />
            <span className="flex-1 text-sm">Routines</span>
            <span className="font-mono text-sm tabular-nums text-fog-300">{routines.length}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <button onClick={() => setAboutOpen(true)} className="btn-ghost w-full">
          <span className="inline-flex items-center justify-center gap-1.5">
            <Info size={16} /> About Ironlog
          </span>
        </button>
        <button onClick={signOut} disabled={signingOut} className="btn-danger w-full">
          <span className="inline-flex items-center justify-center gap-1.5">
            <LogOut size={16} /> {signingOut ? 'Signing out…' : 'Sign out'}
          </span>
        </button>
      </section>

      <Sheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="About Ironlog"
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-3 text-sm text-fog-300">
          <p>
            A personal strength-training log: routines, live set logging with a rest timer,
            per-exercise records and body-weight tracking.
          </p>
          <div>
            <p className="label-mono mb-1">Estimated 1RM</p>
            <p>
              Calculated with the Epley formula —{' '}
              <span className="font-mono text-fog-100">weight × (1 + reps ÷ 30)</span>. Only
              completed, non-warmup sets count.
            </p>
          </div>
          <div>
            <p className="label-mono mb-1">Volume</p>
            <p>
              The sum of <span className="font-mono text-fog-100">weight × reps</span> across every
              completed working set.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
