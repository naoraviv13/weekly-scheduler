import { useEffect, useReducer } from 'react';
import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { Home, Dumbbell, Library, TrendingUp, User, Timer } from 'lucide-react';
import { useData } from './lib/dataContext';
import { Spinner } from './components/ui';
import { elapsedSeconds, formatClock } from './lib/training';

const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/routines', label: 'Routines', icon: Dumbbell },
  { to: '/exercises', label: 'Exercises', icon: Library },
  { to: '/progress', label: 'Progress', icon: TrendingUp },
  { to: '/profile', label: 'Profile', icon: User },
];

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-volt-300 font-mono text-base font-bold text-ink-950">
        I
      </span>
      <span className="text-base font-extrabold tracking-tight">
        Ironlog
      </span>
    </Link>
  );
}

/** Persistent banner offering to jump back into an unfinished session. */
function ActiveWorkoutBar() {
  const { activeWorkout } = useData();
  const location = useLocation();
  const [, force] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    if (!activeWorkout) return undefined;
    const id = setInterval(force, 1000);
    return () => clearInterval(id);
  }, [activeWorkout]);

  if (!activeWorkout) return null;
  if (location.pathname === '/workout') return null;

  return (
    <Link
      to="/workout"
      className="fixed inset-x-0 bottom-[68px] z-30 mx-auto flex max-w-3xl items-center gap-3 border-t border-volt-300/30 bg-volt-300/10 px-4 py-2.5 backdrop-blur-md transition hover:bg-volt-300/15 sm:bottom-0 sm:border-t-0"
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-volt-300 opacity-70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-volt-300" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{activeWorkout.name}</span>
      <span className="flex shrink-0 items-center gap-1 font-mono text-sm font-bold tabular-nums text-volt-300">
        <Timer size={14} />
        {formatClock(elapsedSeconds(activeWorkout.startedAt))}
      </span>
    </Link>
  );
}

function TabBar() {
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-3xl items-stretch border-t border-ink-700 bg-ink-900/95 pt-1 backdrop-blur-md sm:hidden">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition ${
              isActive ? 'text-volt-300' : 'text-fog-400'
            }`
          }
        >
          <Icon size={20} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function DesktopNav() {
  return (
    <nav className="hidden items-center gap-1 sm:flex">
      {TABS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              isActive
                ? 'bg-ink-800 text-volt-300'
                : 'text-fog-400 hover:bg-ink-800 hover:text-fog-100'
            }`
          }
        >
          <Icon size={16} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function App() {
  const { loading, loadError } = useData();
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="mx-auto min-h-screen max-w-3xl">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-4 border-b border-ink-700 bg-ink-950/85 px-4 py-3 backdrop-blur-md">
        <Brand />
        <DesktopNav />
      </header>

      <main className="px-4 pb-32 pt-4 sm:pb-24">
        {loadError ? (
          <div className="card mt-6 px-5 py-6 text-center">
            <p className="font-semibold text-flame-400">Couldn&apos;t load your data</p>
            <p className="mt-1 text-sm text-fog-400">{loadError}</p>
            <p className="mt-3 text-xs text-fog-400">
              If this is a fresh install, run <code className="text-volt-300">supabase-ironlog-schema.sql</code> in
              the Supabase SQL editor first.
            </p>
            <button onClick={() => window.location.reload()} className="btn-ghost mt-4">
              Retry
            </button>
          </div>
        ) : loading ? (
          <Spinner label="Loading your training data" />
        ) : (
          <Outlet />
        )}
      </main>

      <ActiveWorkoutBar />
      <TabBar />
    </div>
  );
}
