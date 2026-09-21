import { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useData } from '../lib/dataContext';
import { Sheet, EmptyState } from '../components/ui';
import { ExercisePicker } from '../components/ExercisePicker';
import { ExerciseBlock } from '../components/WorkoutEditor';
import { RestTimer, RestDurationPicker } from '../components/RestTimer';
import { useRestTimer } from '../lib/useRestTimer';
import * as db from '../supabaseData';
import {
  elapsedSeconds,
  formatDuration,
  workoutVolume,
  workoutSetCount,
  formatVolume,
  lastPerformance,
} from '../lib/training';

export default function ActiveWorkoutRoute() {
  const {
    activeWorkout,
    patchActiveWorkout,
    endWorkout,
    discardWorkout,
    renameActiveWorkout,
    history,
    personalRecords,
    exerciseById,
  } = useData();
  const navigate = useNavigate();

  const [pickerOpen, setPickerOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [, force] = useReducer((x) => x + 1, 0);

  const rest = useRestTimer(90);

  useEffect(() => {
    const id = setInterval(force, 1000);
    return () => clearInterval(id);
  }, []);

  const volume = useMemo(
    () => (activeWorkout ? workoutVolume(activeWorkout) : 0),
    [activeWorkout],
  );
  const setsDone = useMemo(
    () => (activeWorkout ? workoutSetCount(activeWorkout) : 0),
    [activeWorkout],
  );

  if (!activeWorkout) {
    return (
      <EmptyState
        title="No active workout"
        body="Start one from the home screen."
        action={
          <button onClick={() => navigate('/')} className="btn-volt">
            Go home
          </button>
        }
      />
    );
  }

  const addExercises = async (ids) => {
    const base = activeWorkout.exercises.length;
    for (let i = 0; i < ids.length; i++) {
      try {
        const saved = await db.addWorkoutExercise(activeWorkout.id, ids[i], base + i);
        const withExercise = { ...saved, exercise: saved.exercise || exerciseById[ids[i]] };
        patchActiveWorkout((w) => ({ ...w, exercises: [...w.exercises, withExercise] }));
      } catch (e) {
        console.error('Add exercise failed:', e);
      }
    }
  };

  const removeExercise = async (weId) => {
    patchActiveWorkout((w) => ({ ...w, exercises: w.exercises.filter((e) => e.id !== weId) }));
    try {
      await db.removeWorkoutExercise(weId);
    } catch (e) {
      console.error('Remove exercise failed:', e);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await endWorkout(notes || undefined);
      navigate('/');
    } catch (e) {
      console.error('Finish failed:', e);
      setBusy(false);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await discardWorkout();
      navigate('/');
    } catch (e) {
      console.error('Discard failed:', e);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-ink-700 bg-ink-950/90 px-4 py-3 backdrop-blur-md">
        <input
          className="w-full bg-transparent text-xl font-extrabold tracking-tight outline-none"
          value={activeWorkout.name}
          onChange={(e) => renameActiveWorkout(e.target.value)}
          aria-label="Workout name"
        />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-mono text-sm font-bold tabular-nums text-volt-300">
            {formatDuration(elapsedSeconds(activeWorkout.startedAt))}
          </span>
          <span className="font-mono text-xs text-fog-400">
            {formatVolume(volume)} kg · {setsDone} sets
          </span>
          <div className="ml-auto">
            <RestDurationPicker duration={rest.duration} setDuration={rest.setDuration} />
          </div>
        </div>
      </div>

      {activeWorkout.exercises.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Plus}
            title="Empty session"
            body="Add your first exercise to start logging sets."
            action={
              <button onClick={() => setPickerOpen(true)} className="btn-volt">
                Add exercise
              </button>
            }
          />
        </div>
      ) : (
        activeWorkout.exercises.map((we) => (
          <ExerciseBlock
            key={we.id}
            workoutExercise={we}
            previousSession={lastPerformance(history, we.exerciseId, activeWorkout.id)}
            prRecord={personalRecords[we.exerciseId]}
            onMutate={patchActiveWorkout}
            onRestStart={() => rest.start()}
            onRemove={() => removeExercise(we.id)}
          />
        ))
      )}

      <div className="flex flex-col gap-2">
        <button onClick={() => setPickerOpen(true)} className="btn-ghost w-full">
          <span className="inline-flex items-center justify-center gap-1.5">
            <Plus size={16} /> Add exercise
          </span>
        </button>
        <button onClick={() => setFinishOpen(true)} className="btn-volt w-full">
          Finish workout
        </button>
        <button onClick={() => setDiscardOpen(true)} className="btn-danger w-full">
          Discard
        </button>
      </div>

      <RestTimer seconds={rest.remaining} onExtend={rest.extend} onSkip={rest.skip} />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercises}
        multi
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish workout"
        subtitle={`${formatVolume(volume)} kg across ${setsDone} sets`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="label-mono mb-1.5 block">Notes (optional)</label>
            <textarea
              className="field min-h-20 w-full resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How did it feel?"
            />
          </div>
          <button onClick={finish} disabled={busy} className="btn-volt w-full">
            Save workout
          </button>
        </div>
      </Sheet>

      <Sheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="Discard workout?"
        subtitle="This permanently deletes the session and its sets."
        maxWidth="max-w-sm"
      >
        <div className="flex flex-col gap-2">
          <button onClick={discard} disabled={busy} className="btn-danger w-full">
            Yes, discard
          </button>
          <button onClick={() => setDiscardOpen(false)} className="btn-ghost w-full">
            Keep logging
          </button>
        </div>
      </Sheet>
    </div>
  );
}
