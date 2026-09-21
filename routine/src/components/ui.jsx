import { useEffect } from 'react';
import { X } from 'lucide-react';
import { groupColor } from '../lib/training';

/** Bottom sheet on mobile, centred dialog on desktop. */
export function Sheet({ open, onClose, title, subtitle, children, maxWidth = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`card w-full ${maxWidth} max-h-[90vh] overflow-y-auto rounded-b-none sm:rounded-b-2xl`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-700 bg-ink-900/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-fog-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-fog-400 transition hover:bg-ink-800 hover:text-fog-100"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function MuscleChip({ group, className = '' }) {
  const color = groupColor(group);
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider ${className}`}
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {group}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, body, action }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      {Icon && (
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-ink-800 text-fog-400">
          <Icon size={24} />
        </div>
      )}
      <div>
        <p className="font-semibold text-fog-100">{title}</p>
        {body && <p className="mx-auto mt-1 max-w-xs text-sm text-fog-400">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, unit, accent = false }) {
  return (
    <div className="card px-3 py-3">
      <p className="label-mono">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span
          className={`font-mono text-xl font-bold tabular-nums ${accent ? 'text-volt-300' : 'text-fog-100'}`}
        >
          {value}
        </span>
        {unit && <span className="text-xs text-fog-400">{unit}</span>}
      </p>
    </div>
  );
}

export function SectionHeader({ children, action }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="label-mono">{children}</h2>
      {action}
    </div>
  );
}

export function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-fog-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-ink-600 border-t-volt-300" />
      {label && <p className="text-sm">{label}</p>}
    </div>
  );
}
