import { useState } from 'react';
import { trimNum, formatVolume, groupColor } from '../lib/training';

/**
 * Tappable line chart over dated points.
 * `points` is [{ date: 'YYYY-MM-DD', value: number }] sorted oldest first.
 */
export function LineTrend({ points, color = '#3ba9ff', unitLabel = '', emptyHint }) {
  const [selected, setSelected] = useState(null);

  if (points.length === 0) {
    return (
      <div className="grid h-36 place-items-center rounded-xl border border-dashed border-ink-700 px-6 text-center text-sm text-fog-400">
        {emptyHint || 'No data yet.'}
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const PAD_L = 36;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 20;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const values = points.map((p) => p.value);
  let yMin = Math.min(...values);
  let yMax = Math.max(...values);
  const pad = Math.max(0.5, yMax - yMin) * 0.15;
  yMin = Math.floor((yMin - pad) * 2) / 2;
  yMax = Math.ceil((yMax + pad) * 2) / 2;

  const startMs = new Date(`${points[0].date}T00:00:00`).getTime();
  const endMs = new Date(`${points[points.length - 1].date}T00:00:00`).getTime();
  const span = Math.max(1, endMs - startMs);

  const xScale = (d) => PAD_L + ((new Date(`${d}T00:00:00`).getTime() - startMs) / span) * innerW;
  const yScale = (v) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * innerH;

  const coords = points.map((p) => ({ ...p, x: xScale(p.date), y: yScale(p.value) }));
  const path = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');
  const area =
    coords.length > 1
      ? `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${PAD_T + innerH} L ${coords[0].x.toFixed(1)} ${PAD_T + innerH} Z`
      : '';

  const gradId = `grad-${color.replace('#', '')}`;
  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="relative w-full" onClick={() => setSelected(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[160px] w-full">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => {
          const y = yScale(t);
          return (
            <g key={i}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#26262f" strokeWidth="1" />
              <text
                x={PAD_L - 5}
                y={y + 3}
                textAnchor="end"
                fontSize="9"
                fill="#8a8a99"
                fontFamily="JetBrains Mono, monospace"
              >
                {trimNum(t)}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill={`url(#${gradId})`} />}
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {coords.map((p, i) => {
          const isSel = selected?.date === p.date;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isSel ? 5 : coords.length <= 70 ? 2.5 : 0}
                fill={isSel ? '#ccff00' : color}
                className="pointer-events-none"
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={10}
                fill="transparent"
                className="cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelected(p);
                }}
              />
            </g>
          );
        })}
      </svg>

      {selected && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink-800 px-2.5 py-1.5 shadow-lg"
          style={{ left: `${(selected.x / W) * 100}%`, top: `${(selected.y / H) * 100 - 6}%` }}
        >
          <p className="font-mono text-[9px] text-fog-400">{selected.date}</p>
          <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
            {trimNum(selected.value)}
            {unitLabel && <span className="text-[10px] text-fog-400"> {unitLabel}</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/** Weekly training volume as bars. `buckets` is [{ start: Date, volume, sessions }]. */
export function VolumeBars({ buckets }) {
  const [selected, setSelected] = useState(null);
  const max = Math.max(1, ...buckets.map((b) => b.volume));
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  if (buckets.every((b) => b.volume === 0)) {
    return (
      <div className="grid h-32 place-items-center rounded-xl border border-dashed border-ink-700 px-6 text-center text-sm text-fog-400">
        Log a workout to see your weekly volume.
      </div>
    );
  }

  return (
    <div>
      <div className="flex h-32 items-end gap-1">
        {buckets.map((b, i) => {
          const pct = (b.volume / max) * 100;
          const isSel = selected === i;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : i)}
              className="group flex h-full flex-1 flex-col justify-end"
              aria-label={`Week of ${b.start.toDateString()}: ${Math.round(b.volume)} kg`}
            >
              <span
                className={`w-full rounded-t transition ${
                  isSel ? 'bg-volt-300' : 'bg-volt-400/45 group-hover:bg-volt-400/70'
                }`}
                style={{ height: `${Math.max(pct, b.volume > 0 ? 3 : 1)}%` }}
              />
            </button>
          );
        })}
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-fog-400">
        <span>
          {buckets[0].start.getDate()} {months[buckets[0].start.getMonth()]}
        </span>
        <span>
          {selected !== null
            ? `${formatVolume(buckets[selected].volume)} kg · ${buckets[selected].sessions} session${
                buckets[selected].sessions === 1 ? '' : 's'
              }`
            : 'Tap a bar'}
        </span>
        <span>
          {buckets[buckets.length - 1].start.getDate()}{' '}
          {months[buckets[buckets.length - 1].start.getMonth()]}
        </span>
      </div>
    </div>
  );
}

/** Horizontal share bars of completed sets per muscle group. */
export function MuscleSplit({ split }) {
  if (split.length === 0) {
    return (
      <div className="grid h-24 place-items-center rounded-xl border border-dashed border-ink-700 px-6 text-center text-sm text-fog-400">
        No completed sets in this range.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {split.map(({ group, sets, share }) => (
        <div key={group} className="flex items-center gap-2.5">
          <span className="w-20 shrink-0 text-xs capitalize text-fog-300">{group}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(share * 100, 2)}%`, backgroundColor: groupColor(group) }}
            />
          </div>
          <span className="w-14 shrink-0 text-right font-mono text-[11px] tabular-nums text-fog-400">
            {sets} · {Math.round(share * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}
