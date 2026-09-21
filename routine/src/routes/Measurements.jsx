import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Ruler, Pencil, Check, X } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { SectionHeader, EmptyState, Sheet } from '../components/ui';
import { LineTrend } from '../components/charts';
import { dateKey } from '../supabaseData';
import {
  MEASUREMENT_METRICS,
  groupMeasurements,
  metricLabel,
  metricUnit,
  unitSuffix,
  trimNum,
  formatDateLabel,
} from '../lib/training';

const METRIC_COLOR = '#c07cff';

export default function MeasurementsRoute() {
  const { measurements, saveMeasurement, removeMeasurement } = useData();
  const [logOpen, setLogOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState(null);
  const [draft, setDraft] = useState({});
  const [date, setDate] = useState(() => dateKey(new Date()));
  const [editingEntry, setEditingEntry] = useState(null); // `${date}|${metric}`
  const [entryDraft, setEntryDraft] = useState('');

  const grouped = useMemo(() => groupMeasurements(measurements), [measurements]);
  const tracked = MEASUREMENT_METRICS.filter((m) => grouped[m.key]);

  const openLog = () => {
    // Pre-fill each field with its latest value so small tweaks are quick.
    const seed = {};
    MEASUREMENT_METRICS.forEach((m) => {
      const latest = grouped[m.key]?.latest;
      seed[m.key] = latest ? String(latest.value) : '';
    });
    setDraft(seed);
    setDate(dateKey(new Date()));
    setLogOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    const writes = [];
    MEASUREMENT_METRICS.forEach((m) => {
      const raw = (draft[m.key] ?? '').toString().trim();
      if (!raw) return;
      const num = parseFloat(raw.replace(',', '.'));
      if (Number.isNaN(num) || num <= 0 || num >= 1000) return;
      // Skip values identical to what's already stored for this date.
      const existing = grouped[m.key]?.entries.find((x) => x.date === date);
      if (existing && existing.value === Math.round(num * 100) / 100) return;
      writes.push(saveMeasurement(date, m.key, Math.round(num * 100) / 100, m.unit));
    });
    await Promise.all(writes);
    setLogOpen(false);
  };

  const detail = activeMetric ? grouped[activeMetric] : null;

  const beginEditEntry = (entry) => {
    setEditingEntry(`${entry.date}|${entry.metric}`);
    setEntryDraft(String(entry.value));
  };

  const saveEditEntry = (entry) => {
    const num = parseFloat(entryDraft.replace(',', '.'));
    if (Number.isNaN(num) || num <= 0 || num >= 1000) return;
    saveMeasurement(entry.date, entry.metric, Math.round(num * 100) / 100, entry.unit);
    setEditingEntry(null);
  };

  return (
    <div className="flex flex-col gap-5">
      <Link to="/progress" className="inline-flex items-center gap-1.5 text-sm text-fog-400">
        <ArrowLeft size={16} /> Progress
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Measurements</h1>
        <button onClick={openLog} className="btn-volt px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5">
            <Plus size={16} /> Log
          </span>
        </button>
      </div>

      {tracked.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Ruler}
            title="Nothing measured yet"
            body="Record chest, waist, arms and more to see how your shape changes alongside your lifting."
            action={
              <button onClick={openLog} className="btn-volt">
                Take first measurements
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {tracked.map((m) => {
            const g = grouped[m.key];
            const suffix = unitSuffix(m.unit);
            return (
              <button
                key={m.key}
                onClick={() => setActiveMetric(m.key)}
                className="card px-3 py-3 text-left transition hover:border-ink-600"
              >
                <p className="label-mono">{m.label}</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="font-mono text-xl font-bold tabular-nums">
                    {trimNum(g.latest.value)}
                  </span>
                  <span className="text-xs text-fog-400">{suffix}</span>
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                  {g.delta !== null && g.delta !== 0 ? (
                    <span className={g.delta > 0 ? 'text-mint-400' : 'text-flame-400'}>
                      {g.delta > 0 ? '+' : ''}
                      {trimNum(g.delta)} {suffix}
                    </span>
                  ) : (
                    <span className="text-fog-400">no change</span>
                  )}
                  <span className="text-fog-400">· {g.entries.length} entries</span>
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Per-metric detail */}
      <Sheet
        open={!!activeMetric}
        onClose={() => setActiveMetric(null)}
        title={activeMetric ? metricLabel(activeMetric) : ''}
        subtitle={
          detail ? `${detail.entries.length} entries · latest ${trimNum(detail.latest.value)}${unitSuffix(metricUnit(activeMetric))}` : ''
        }
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <LineTrend
              points={detail.entries.map((e) => ({ date: e.date, value: e.value }))}
              color={METRIC_COLOR}
              unitLabel={unitSuffix(metricUnit(activeMetric))}
            />

            <div>
              <SectionHeader>All entries</SectionHeader>
              <div className="flex flex-col gap-1">
                {detail.entries
                  .slice()
                  .reverse()
                  .map((e) => {
                    const key = `${e.date}|${e.metric}`;
                    const isEditing = editingEntry === key;
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ink-800"
                      >
                        <span className="flex-1 text-sm text-fog-300">
                          {formatDateLabel(`${e.date}T00:00:00`)}
                        </span>

                        {isEditing ? (
                          <>
                            <input
                              className="field w-24 px-2 py-1 text-center font-mono text-sm tabular-nums"
                              type="number"
                              step="0.1"
                              inputMode="decimal"
                              autoFocus
                              value={entryDraft}
                              onChange={(ev) => setEntryDraft(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === 'Enter') saveEditEntry(e);
                                if (ev.key === 'Escape') setEditingEntry(null);
                              }}
                              aria-label={`Value for ${e.date}`}
                            />
                            <button
                              onClick={() => saveEditEntry(e)}
                              className="grid h-7 w-7 place-items-center rounded-md bg-volt-300 text-ink-950"
                              aria-label="Save"
                            >
                              <Check size={14} strokeWidth={3} />
                            </button>
                            <button
                              onClick={() => setEditingEntry(null)}
                              className="grid h-7 w-7 place-items-center rounded-md text-fog-400 hover:text-fog-100"
                              aria-label="Cancel"
                            >
                              <X size={14} />
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="font-mono text-sm tabular-nums">
                              {trimNum(e.value)}
                              <span className="text-[10px] text-fog-400"> {unitSuffix(e.unit)}</span>
                            </span>
                            <button
                              onClick={() => beginEditEntry(e)}
                              className="rounded p-1 text-fog-400 transition hover:text-fog-100"
                              aria-label={`Edit ${e.metric} on ${e.date}`}
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete ${metricLabel(e.metric)} from ${e.date}?`,
                                  )
                                ) {
                                  removeMeasurement(e.date, e.metric);
                                }
                              }}
                              className="rounded p-1 text-fog-400 transition hover:text-flame-400"
                              aria-label={`Delete ${e.metric} on ${e.date}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      {/* Log sheet */}
      <Sheet
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log measurements"
        subtitle="Leave a field blank to skip it"
      >
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block">Date</label>
            <input
              className="field w-full"
              type="date"
              value={date}
              max={dateKey(new Date())}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {MEASUREMENT_METRICS.map((m) => (
              <div key={m.key}>
                <label className="label-mono mb-1 block" htmlFor={`m-${m.key}`}>
                  {m.label} ({unitSuffix(m.unit)})
                </label>
                <input
                  id={`m-${m.key}`}
                  className="field w-full font-mono tabular-nums"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={draft[m.key] ?? ''}
                  onChange={(e) => setDraft({ ...draft, [m.key]: e.target.value })}
                  placeholder="—"
                />
              </div>
            ))}
          </div>

          <button type="submit" className="btn-volt mt-1 w-full">
            Save measurements
          </button>
        </form>
      </Sheet>
    </div>
  );
}
