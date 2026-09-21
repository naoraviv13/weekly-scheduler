import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trash2, Layers } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { EmptyState, MuscleChip, StatTile, Sheet } from '../components/ui';
import {
  formatFullDate,
  formatTimeOfDay,
  formatDuration,
  elapsedSeconds,
  workoutVolume,
  workoutSetCount,
  formatVolume,
  trimNum,
  estimateOneRepMax,
} from '../lib/training';

export default function WorkoutDetailRoute() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { history, removeWorkout } = useData();
  const [confirm, setConfirm] = useState(false);

  const workout = useMemo(() => history.find((w) => w.id === id), [history, id]);

  if (!workout) {
    return (
      <EmptyState
        title="Workout not found"
        body="It may have been deleted."
        action={
          <button onClick={() => navigate('/progress')} className="btn-volt">
            Back to history
          </button>
        }
      />
    );
  }

  const duration = workout.endedAt ? elapsedSeconds(workout.startedAt, workout.endedAt) : 0;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/progress" className="inline-flex items-center gap-1.5 text-sm text-fog-400">
        <ArrowLeft size={16} /> History
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{workout.name}</h1>
        <p className="mt-1 text-sm text-fog-400">
          {formatFullDate(workout.startedAt)} · {formatTimeOfDay(workout.startedAt)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Duration" value={formatDuration(duration)} />
        <StatTile label="Volume" value={formatVolume(workoutVolume(workout))} unit="kg" accent />
        <StatTile label="Sets" value={workoutSetCount(workout)} />
      </div>

      {workout.notes && (
        <div className="card px-4 py-3">
          <p className="label-mono mb-1">Notes</p>
          <p className="whitespace-pre-wrap text-sm text-fog-300">{workout.notes}</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {workout.exercises.length === 0 ? (
          <div className="card">
            <EmptyState icon={Layers} title="No exercises logged" />
          </div>
        ) : (
          workout.exercises.map((we) => {
            const done = we.sets.filter((s) => s.isComplete && !s.isWarmup);
            const best = done.reduce(
              (m, s) => Math.max(m, estimateOneRepMax(s.weightKg, s.reps)),
              0,
            );
            return (
              <div key={we.id} className="card px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to={`/exercises/${we.exerciseId}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{we.exercise?.name || 'Exercise'}</p>
                    {we.exercise && (
                      <div className="mt-1">
                        <MuscleChip group={we.exercise.muscleGroup} />
                      </div>
                    )}
                  </Link>
                  {best > 0 && (
                    <div className="shrink-0 text-right">
                      <p className="label-mono">Est. 1RM</p>
                      <p className="font-mono text-sm font-bold tabular-nums text-volt-300">
                        {trimNum(Math.round(best))}
                      </p>
                    </div>
                  )}
                </div>

                {done.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-ink-700 pt-2">
                    {done.map((s, i) => (
                      <span
                        key={s.id || i}
                        className="rounded-md bg-ink-800 px-2 py-1 font-mono text-[11px] tabular-nums text-fog-300"
                      >
                        {trimNum(s.weightKg)}×{s.reps}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <button onClick={() => setConfirm(true)} className="btn-danger w-full">
        <span className="inline-flex items-center justify-center gap-1.5">
          <Trash2 size={16} /> Delete workout
        </span>
      </button>

      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Delete this workout?"
        subtitle="The session and all its sets are removed permanently."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              removeWorkout(workout.id);
              navigate('/progress');
            }}
            className="btn-danger w-full"
          >
            Yes, delete
          </button>
          <button onClick={() => setConfirm(false)} className="btn-ghost w-full">
            Cancel
          </button>
        </div>
      </Sheet>
    </div>
  );
}
