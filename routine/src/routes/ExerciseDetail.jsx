import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { EmptyState, MuscleChip, StatTile, SectionHeader } from '../components/ui';
import {
  buildExerciseHistory,
  trimNum,
  formatDateLabel,
  formatVolume,
  groupColor,
} from '../lib/training';

/** Compact sparkline of top estimated 1RM per session, oldest to newest. */
function TrendLine({ points, color }) {
  if (points.length < 2) return null;

  const W = 300;
  const H = 70;
  const PAD = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(0.001, max - min);

  const coords = points.map((p, i) => ({
    x: PAD + (i / (points.length - 1)) * (W - PAD * 2),
    y: PAD + (1 - (p.value - min) / range) * (H - PAD * 2),
  }));

  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${coords[coords.length - 1].x.toFixed(1)} ${H - PAD} L ${coords[0].x.toFixed(1)} ${H - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-[70px] w-full">
      <defs>
        <linearGradient id="trendGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#trendGrad)" />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export default function ExerciseDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { exerciseById, history, personalRecords } = useData();

  const exercise = exerciseById[id];
  const sessions = useMemo(() => buildExerciseHistory(history, id), [history, id]);
  const pr = personalRecords[id];

  const trendPoints = useMemo(
    () =>
      sessions
        .slice()
        .reverse()
        .map((s) => ({ value: s.topOneRm })),
    [sessions],
  );

  if (!exercise) {
    return (
      <EmptyState
        title="Exercise not found"
        action={
          <button onClick={() => navigate('/exercises')} className="btn-volt">
            Back to library
          </button>
        }
      />
    );
  }

  const color = groupColor(exercise.muscleGroup);

  return (
    <div className="flex flex-col gap-4">
      <Link to="/exercises" className="inline-flex items-center gap-1.5 text-sm text-fog-400">
        <ArrowLeft size={16} /> Library
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{exercise.name}</h1>
        <div className="mt-1.5 flex items-center gap-2">
          <MuscleChip group={exercise.muscleGroup} />
          <span className="text-xs capitalize text-fog-400">{exercise.equipment}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Best set" value={pr ? trimNum(pr.bestWeight) : '0'} unit="kg" accent />
        <StatTile
          label="Est. 1RM"
          value={pr ? trimNum(Math.round(pr.bestOneRm)) : '0'}
          unit="kg"
        />
        <StatTile label="Sessions" value={sessions.length} />
      </div>

      {trendPoints.length >= 2 && (
        <div className="card px-4 py-3">
          <SectionHeader>Estimated 1RM trend</SectionHeader>
          <TrendLine points={trendPoints} color={color} />
          <div className="mt-1 flex justify-between font-mono text-[10px] text-fog-400">
            <span>{formatDateLabel(sessions[sessions.length - 1].date)}</span>
            <span>{formatDateLabel(sessions[0].date)}</span>
          </div>
        </div>
      )}

      <div>
        <SectionHeader>History</SectionHeader>
        {sessions.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={TrendingUp}
              title="Not logged yet"
              body="Complete a set of this exercise and it will show up here."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.map((s) => (
              <Link
                key={s.workoutId}
                to={`/workout/${s.workoutId}`}
                className="card px-4 py-3 transition hover:border-ink-600"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{formatDateLabel(s.date)}</p>
                  <p className="font-mono text-xs text-fog-400">
                    {formatVolume(s.volume)} kg volume
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {s.sets.map((set, i) => (
                    <span
                      key={set.id || i}
                      className="rounded-md bg-ink-800 px-2 py-1 font-mono text-[11px] tabular-nums text-fog-300"
                    >
                      {trimNum(set.weightKg)}×{set.reps}
                    </span>
                  ))}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
