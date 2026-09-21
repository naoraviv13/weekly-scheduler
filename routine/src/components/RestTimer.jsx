import { Timer, SkipForward } from 'lucide-react';
import { formatClock } from '../lib/training';
import { REST_PRESETS } from '../lib/useRestTimer';

/**
 * Countdown shown after completing a set. Fixed to the viewport so it stays
 * visible while the user scrolls between exercises.
 */
export function RestTimer({ seconds, onExtend, onSkip }) {
  if (seconds === null) return null;

  return (
    <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-3xl px-4 sm:bottom-4">
      <div className="flex items-center gap-3 rounded-2xl border border-volt-300/40 bg-ink-850/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md">
        <Timer size={18} className="shrink-0 text-volt-300" />
        <div className="min-w-0 flex-1">
          <p className="label-mono">Rest</p>
          <p className="font-mono text-xl font-bold tabular-nums text-volt-300">
            {formatClock(seconds)}
          </p>
        </div>
        <button onClick={() => onExtend(15)} className="btn-ghost px-3 py-2 text-xs">
          +15s
        </button>
        <button onClick={onSkip} className="btn-volt px-3 py-2 text-xs" aria-label="Skip rest">
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}

/** Lets the user pick the default rest length for the session. */
export function RestDurationPicker({ duration, setDuration }) {
  return (
    <div className="flex items-center gap-2">
      <span className="label-mono">Rest</span>
      <div className="flex gap-1">
        {REST_PRESETS.map((s) => (
          <button
            key={s}
            onClick={() => setDuration(s)}
            className={`rounded-lg px-2 py-1 font-mono text-xs transition ${
              duration === s ? 'bg-volt-300 text-ink-950' : 'bg-ink-800 text-fog-300'
            }`}
          >
            {s < 60 ? `${s}s` : `${s / 60}m`}
          </button>
        ))}
      </div>
    </div>
  );
}
