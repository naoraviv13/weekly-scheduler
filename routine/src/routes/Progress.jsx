import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scale, Trash2, Flame, ChevronRight, Ruler, Trophy } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { SectionHeader, StatTile, EmptyState, Sheet, MuscleChip } from '../components/ui';
import { VolumeBars, MuscleSplit } from '../components/charts';
import { dateKey, addDays } from '../supabaseData';
import {
  trimNum,
  formatVolume,
  formatDateLabel,
  workoutVolume,
  workoutSetCount,
  formatDuration,
  elapsedSeconds,
  weeklyVolume,
  muscleSplit,
  recentPersonalRecords,
  groupMeasurements,
  metricLabel,
  unitSuffix,
} from '../lib/training';

const RANGES = [
  { key: 'month', label: '1M', days: 30 },
  { key: 'quarter', label: '3M', days: 90 },
  { key: 'halfyear', label: '6M', days: 182 },
  { key: 'year', label: '1Y', days: 365 },
];

/** Line chart of body weight with tap-to-inspect points. */
function WeightChart({ entries, days, onEdit }) {
  const [selected, setSelected] = useState(null);

  if (entries.length === 0) {
    return (
      <div className="grid h-40 place-items-center rounded-xl border border-dashed border-ink-700 px-6 text-center text-sm text-fog-400">
        Log your weight to start tracking the trend.
      </div>
    );
  }

  const W = 600;
  const H = 180;
  const PAD_L = 34;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 22;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  const weights = entries.map((e) => e.weight);
  let yMin = Math.min(...weights);
  let yMax = Math.max(...weights);
  const pad = Math.max(1, yMax - yMin) * 0.15;
  yMin = Math.floor((yMin - pad) * 2) / 2;
  yMax = Math.ceil((yMax + pad) * 2) / 2;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startMs = addDays(today, -(days - 1)).getTime();
  const endMs = today.getTime();

  const xScale = (d) => {
    const ms = new Date(`${d}T00:00:00`).getTime();
    return PAD_L + ((ms - startMs) / Math.max(1, endMs - startMs)) * innerW;
  };
  const yScale = (w) => PAD_T + (1 - (w - yMin) / (yMax - yMin)) * innerH;

  const points = entries.map((e) => ({ ...e, x: xScale(e.date), y: yScale(e.weight) }));
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area =
    points.length > 1
      ? `${path} L ${points[points.length - 1].x.toFixed(1)} ${PAD_T + innerH} L ${points[0].x.toFixed(1)} ${PAD_T + innerH} Z`
      : '';

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];

  return (
    <div className="relative w-full" onClick={() => setSelected(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[180px] w-full">
        <defs>
          <linearGradient id="wGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3ba9ff" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#3ba9ff" stopOpacity="0" />
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
                {t.toFixed(1)}
              </text>
            </g>
          );
        })}

        {area && <path d={area} fill="url(#wGrad)" />}
        <path
          d={path}
          fill="none"
          stroke="#3ba9ff"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((p, i) => {
          const isSel = selected?.date === p.date;
          return (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={isSel ? 5 : points.length <= 70 ? 2.5 : 0}
                fill={isSel ? '#ccff00' : '#3ba9ff'}
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
          className="absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-ink-800 px-2.5 py-1.5 shadow-lg"
          style={{ left: `${(selected.x / W) * 100}%`, top: `${(selected.y / H) * 100 - 6}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="font-mono text-[9px] text-fog-400">{selected.date}</p>
          <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
            {trimNum(selected.weight)} kg
          </p>
          {onEdit && (
            <button
              onClick={() => {
                onEdit(selected);
                setSelected(null);
              }}
              className="mt-1 w-full rounded bg-ink-700 px-2 py-1 text-[10px] font-semibold text-fog-100 transition hover:bg-ink-600"
            >
              Edit
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** GitHub-style activity grid of the last N weeks. */
function ActivityHeatmap({ history, weeks = 18 }) {
  const counts = useMemo(() => {
    const map = {};
    history.forEach((w) => {
      const k = dateKey(new Date(w.startedAt));
      map[k] = (map[k] || 0) + 1;
    });
    return map;
  }, [history]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Walk back to the most recent Sunday so columns line up as weeks.
  const end = addDays(today, 6 - today.getDay());
  const start = addDays(end, -(weeks * 7 - 1));

  const columns = [];
  for (let c = 0; c < weeks; c++) {
    const col = [];
    for (let r = 0; r < 7; r++) {
      const d = addDays(start, c * 7 + r);
      const k = dateKey(d);
      col.push({ key: k, count: counts[k] || 0, future: d > today });
    }
    columns.push(col);
  }

  const shade = (count, future) => {
    if (future) return 'transparent';
    if (count === 0) return '#1c1c24';
    if (count === 1) return '#5c7300';
    if (count === 2) return '#9ecc00';
    return '#ccff00';
  };

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex gap-[3px]">
        {columns.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((cell) => (
              <div
                key={cell.key}
                title={cell.future ? '' : `${cell.key}: ${cell.count} workout(s)`}
                className="h-[11px] w-[11px] rounded-[2px]"
                style={{ backgroundColor: shade(cell.count, cell.future) }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ProgressRoute() {
  const { weightEntries, history, measurements, saveWeight, removeWeight } = useData();
  const [range, setRange] = useState('quarter');
  const [weightSheet, setWeightSheet] = useState(false);
  const [draft, setDraft] = useState('');
  const [weightDate, setWeightDate] = useState(() => dateKey(new Date()));
  // Captured once per mount: calling Date.now() during render is impure.
  const [nowMs] = useState(() => Date.now());

  const days = RANGES.find((r) => r.key === range)?.days ?? 90;

  const windowEntries = useMemo(() => {
    const since = dateKey(addDays(new Date(), -(days - 1)));
    return weightEntries.filter((w) => w.date >= since);
  }, [weightEntries, days]);

  const windowWorkouts = useMemo(() => {
    const cutoff = nowMs - days * 86400000;
    return history.filter((w) => new Date(w.startedAt).getTime() >= cutoff);
  }, [history, days, nowMs]);

  const totals = useMemo(
    () => ({
      sessions: windowWorkouts.length,
      volume: windowWorkouts.reduce((s, w) => s + workoutVolume(w), 0),
      sets: windowWorkouts.reduce((s, w) => s + workoutSetCount(w), 0),
      time: windowWorkouts.reduce(
        (s, w) => s + (w.endedAt ? elapsedSeconds(w.startedAt, w.endedAt) : 0),
        0,
      ),
    }),
    [windowWorkouts],
  );

  const latest = weightEntries.length > 0 ? weightEntries[weightEntries.length - 1] : null;
  const first = windowEntries.length > 0 ? windowEntries[0] : null;
  const delta = latest && first && latest.date !== first.date ? latest.weight - first.weight : null;

  // Show roughly one bar per week of the selected range, capped so the
  // bars stay wide enough to tap on a phone.
  const volumeBuckets = useMemo(
    () => weeklyVolume(history, Math.min(26, Math.max(6, Math.round(days / 7))), new Date(nowMs)),
    [history, days, nowMs],
  );

  const split = useMemo(() => muscleSplit(windowWorkouts), [windowWorkouts]);
  const prFeed = useMemo(() => recentPersonalRecords(history, 6), [history]);

  const measurementSummary = useMemo(() => {
    const grouped = groupMeasurements(measurements);
    return Object.entries(grouped)
      .map(([metric, g]) => ({ metric, latest: g.latest, delta: g.delta }))
      .slice(0, 4);
  }, [measurements]);

  const today = dateKey(new Date());
  const todayEntry = weightEntries.find((w) => w.date === today);
  const editingExisting = weightEntries.some((w) => w.date === weightDate);

  const openWeightSheet = (date, value) => {
    setWeightDate(date);
    setDraft(value !== undefined && value !== null ? String(value) : '');
    setWeightSheet(true);
  };

  const submitWeight = (e) => {
    e.preventDefault();
    const num = parseFloat(draft.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0 || num >= 500) return;
    saveWeight(weightDate, Math.round(num * 100) / 100);
    setWeightSheet(false);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold tracking-tight">Progress</h1>

      <div className="flex gap-1 rounded-xl bg-ink-800 p-1">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
              range === r.key ? 'bg-volt-300 text-ink-950' : 'text-fog-300'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Sessions" value={totals.sessions} accent />
        <StatTile label="Volume" value={formatVolume(totals.volume)} unit="kg" />
        <StatTile label="Sets" value={totals.sets} />
        <StatTile label="Time" value={formatDuration(totals.time)} />
      </div>

      <section>
        <SectionHeader>Weekly volume</SectionHeader>
        <div className="card px-4 py-4">
          <VolumeBars buckets={volumeBuckets} />
        </div>
      </section>

      <section>
        <SectionHeader>Muscle split</SectionHeader>
        <div className="card px-4 py-4">
          <MuscleSplit split={split} />
        </div>
      </section>

      <section>
        <SectionHeader>Activity</SectionHeader>
        <div className="card px-3 py-3">
          <ActivityHeatmap history={history} />
        </div>
      </section>

      <section>
        <SectionHeader
          action={
            <Link to="/measurements" className="text-xs font-medium text-volt-300">
              {measurementSummary.length > 0 ? 'All' : 'Log'}
            </Link>
          }
        >
          Measurements
        </SectionHeader>

        {measurementSummary.length === 0 ? (
          <Link to="/measurements" className="card block transition hover:border-ink-600">
            <EmptyState
              icon={Ruler}
              title="No measurements yet"
              body="Track chest, waist, arms and body fat alongside your lifting."
            />
          </Link>
        ) : (
          <Link to="/measurements" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {measurementSummary.map((m) => (
              <div key={m.metric} className="card px-3 py-3 transition hover:border-ink-600">
                <p className="label-mono">{metricLabel(m.metric)}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-lg font-bold tabular-nums">
                    {trimNum(m.latest.value)}
                  </span>
                  <span className="text-[10px] text-fog-400">{unitSuffix(m.latest.unit)}</span>
                </p>
                {m.delta !== null && m.delta !== 0 && (
                  <p
                    className={`mt-0.5 font-mono text-[11px] ${
                      m.delta > 0 ? 'text-mint-400' : 'text-flame-400'
                    }`}
                  >
                    {m.delta > 0 ? '+' : ''}
                    {trimNum(m.delta)}
                  </p>
                )}
              </div>
            ))}
          </Link>
        )}
      </section>

      {prFeed.length > 0 && (
        <section>
          <SectionHeader>Recent records</SectionHeader>
          <div className="flex flex-col gap-2">
            {prFeed.map((pr, i) => (
              <Link
                key={`${pr.workoutId}-${pr.exerciseId}-${i}`}
                to={`/exercises/${pr.exerciseId}`}
                className="card flex items-center gap-3 px-4 py-3 transition hover:border-ink-600"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-volt-300/10 text-volt-300">
                  <Trophy size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{pr.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {pr.muscleGroup && <MuscleChip group={pr.muscleGroup} />}
                    <span className="font-mono text-[11px] text-fog-400">
                      {trimNum(pr.weightKg)}×{pr.reps} · {formatDateLabel(pr.date)}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="label-mono">Est. 1RM</p>
                  <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
                    {trimNum(Math.round(pr.oneRm))}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeader
          action={
            <button
              onClick={() => openWeightSheet(today, todayEntry?.weight)}
              className="text-xs font-medium text-volt-300"
            >
              {todayEntry ? 'Update today' : 'Log today'}
            </button>
          }
        >
          Body weight
        </SectionHeader>

        <div className="card px-4 py-4">
          <div className="mb-3 flex items-end justify-between">
            <div>
              <p className="label-mono">Latest</p>
              <p className="mt-0.5 flex items-baseline gap-1.5">
                <span className="font-mono text-3xl font-bold tabular-nums text-sky-400">
                  {latest ? trimNum(latest.weight) : '—'}
                </span>
                <span className="text-xs text-fog-400">kg</span>
              </p>
            </div>
            {delta !== null && (
              <div className="text-right">
                <p className="label-mono">Change</p>
                <p
                  className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${
                    delta > 0 ? 'text-flame-400' : delta < 0 ? 'text-mint-400' : 'text-fog-400'
                  }`}
                >
                  {delta > 0 ? '+' : ''}
                  {trimNum(delta)}
                </p>
              </div>
            )}
          </div>

          <WeightChart
            entries={windowEntries}
            days={days}
            onEdit={(p) => openWeightSheet(p.date, p.weight)}
          />

          <p className="mt-2 text-[11px] text-fog-400">
            Tap any point on the chart to edit that day&apos;s entry.
          </p>
        </div>
      </section>

      <section>
        <SectionHeader>History</SectionHeader>
        {windowWorkouts.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={Flame}
              title="No sessions in this range"
              body="Log a workout and it will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {windowWorkouts.map((w) => (
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

      <Sheet
        open={weightSheet}
        onClose={() => setWeightSheet(false)}
        title={editingExisting ? 'Edit body weight' : 'Log body weight'}
        maxWidth="max-w-sm"
      >
        <form onSubmit={submitWeight} className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block" htmlFor="weight-date">
              Date
            </label>
            <input
              id="weight-date"
              className="field w-full"
              type="date"
              value={weightDate}
              max={today}
              onChange={(e) => setWeightDate(e.target.value)}
            />
          </div>

          <div>
            <label className="label-mono mb-1.5 block" htmlFor="weight-value">
              Weight
            </label>
            <div className="flex items-center gap-2">
              <input
                id="weight-value"
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
          </div>

          <button type="submit" className="btn-volt w-full">
            <span className="inline-flex items-center justify-center gap-1.5">
              <Scale size={16} /> {editingExisting ? 'Update' : 'Save'}
            </span>
          </button>

          {editingExisting && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete the weight entry for ${weightDate}?`)) {
                  removeWeight(weightDate);
                  setWeightSheet(false);
                }
              }}
              className="btn-danger w-full"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <Trash2 size={16} /> Delete entry
              </span>
            </button>
          )}
        </form>
      </Sheet>
    </div>
  );
}
