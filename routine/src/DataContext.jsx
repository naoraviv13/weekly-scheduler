import { useEffect, useMemo, useState, useCallback } from 'react';
import * as db from './supabaseData';
import { buildPersonalRecords } from './lib/training';
import { DataContext } from './lib/dataContext';

export function DataProvider({ userId, children }) {
  const [exercises, setExercises] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeWorkout, setActiveWorkout] = useState(null);
  const [weightEntries, setWeightEntries] = useState([]);
  const [measurements, setMeasurements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // ---- initial load -------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      setLoadError(null);
      try {
        const [ex, rt, hist, active, weights, meas] = await Promise.all([
          db.fetchExercises(),
          db.fetchRoutines(),
          db.fetchWorkoutHistory(),
          db.fetchActiveWorkout(),
          db.fetchWeightEntries(userId, 365),
          // Measurements are optional: if the Phase 2 migration hasn't been
          // run yet, degrade to an empty list rather than failing the whole app.
          db.fetchMeasurements(userId, 365).catch((e) => {
            console.warn('Measurements unavailable (run supabase-ironlog-phase2.sql):', e.message);
            return [];
          }),
        ]);
        if (cancelled) return;
        setExercises(ex);
        setRoutines(rt);
        setHistory(hist);
        setActiveWorkout(active);
        setWeightEntries(weights);
        setMeasurements(meas);
      } catch (e) {
        console.error('Load failed:', e);
        if (!cancelled) setLoadError(e.message || 'Failed to load your data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const exerciseById = useMemo(() => {
    const map = {};
    exercises.forEach((e) => {
      map[e.id] = e;
    });
    return map;
  }, [exercises]);

  const personalRecords = useMemo(() => buildPersonalRecords(history), [history]);

  // ---- exercises ----------------------------------------------------------

  const createExercise = useCallback(
    async (payload) => {
      const saved = await db.addCustomExercise(userId, payload);
      setExercises((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)));
      return saved;
    },
    [userId],
  );

  const editExercise = useCallback(async (id, patch) => {
    const saved = await db.updateExercise(id, patch);
    setExercises((prev) =>
      prev.map((e) => (e.id === id ? saved : e)).sort((a, b) => a.name.localeCompare(b.name)),
    );
    return saved;
  }, []);

  const removeExercise = useCallback(async (id) => {
    await db.deleteExercise(id);
    setExercises((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ---- routines -----------------------------------------------------------

  const saveRoutine = useCallback(
    async (routine) => {
      const saved = await db.upsertRoutine(userId, routine);
      setRoutines((prev) => {
        const idx = prev.findIndex((r) => r.id === saved.id);
        if (idx === -1) return [...prev, saved];
        const copy = prev.slice();
        copy[idx] = saved;
        return copy;
      });
      return saved;
    },
    [userId],
  );

  const removeRoutine = useCallback(async (id) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id));
    try {
      await db.deleteRoutine(id);
    } catch (e) {
      console.error('Delete routine failed:', e);
      setRoutines(await db.fetchRoutines());
    }
  }, []);

  // ---- workout session ----------------------------------------------------

  const beginWorkout = useCallback(
    async ({ routine, name } = {}) => {
      const workout = await db.startWorkout(userId, { routine, name });
      setActiveWorkout(workout);
      return workout;
    },
    [userId],
  );

  const refreshActiveWorkout = useCallback(async () => {
    if (!activeWorkout) return null;
    const fresh = await db.fetchWorkoutById(activeWorkout.id);
    setActiveWorkout(fresh);
    return fresh;
  }, [activeWorkout]);

  const endWorkout = useCallback(
    async (notes) => {
      if (!activeWorkout) return null;
      const finished = await db.finishWorkout(activeWorkout.id, { notes });
      setActiveWorkout(null);
      setHistory((prev) => [finished, ...prev]);
      return finished;
    },
    [activeWorkout],
  );

  const discardWorkout = useCallback(async () => {
    if (!activeWorkout) return;
    const id = activeWorkout.id;
    setActiveWorkout(null);
    try {
      await db.deleteWorkout(id);
    } catch (e) {
      console.error('Discard failed:', e);
    }
  }, [activeWorkout]);

  const renameActiveWorkout = useCallback(
    async (name) => {
      if (!activeWorkout) return;
      setActiveWorkout((prev) => (prev ? { ...prev, name } : prev));
      try {
        await db.updateWorkout(activeWorkout.id, { name });
      } catch (e) {
        console.error('Rename failed:', e);
      }
    },
    [activeWorkout],
  );

  /** Apply a local mutation to the active workout without a refetch. */
  const patchActiveWorkout = useCallback((updater) => {
    setActiveWorkout((prev) => (prev ? updater(prev) : prev));
  }, []);

  // ---- history ------------------------------------------------------------

  /** Apply a local mutation to one finished workout without a refetch. */
  const patchHistoryWorkout = useCallback((workoutId, updater) => {
    setHistory((prev) => prev.map((w) => (w.id === workoutId ? updater(w) : w)));
  }, []);

  /** Edit a finished workout's name, notes or date. */
  const editWorkout = useCallback(async (id, patch) => {
    setHistory((prev) => {
      const next = prev.map((w) => (w.id === id ? { ...w, ...patch } : w));
      // Changing the date can reorder the history list.
      return patch.startedAt
        ? next.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt))
        : next;
    });
    try {
      await db.updateWorkout(id, patch);
    } catch (e) {
      console.error('Edit workout failed:', e);
      setHistory(await db.fetchWorkoutHistory());
    }
  }, []);

  const removeWorkout = useCallback(async (id) => {
    setHistory((prev) => prev.filter((w) => w.id !== id));
    try {
      await db.deleteWorkout(id);
    } catch (e) {
      console.error('Delete workout failed:', e);
      setHistory(await db.fetchWorkoutHistory());
    }
  }, []);

  // ---- weight -------------------------------------------------------------

  const saveWeight = useCallback(
    async (date, weight) => {
      setWeightEntries((prev) => {
        const without = prev.filter((w) => w.date !== date);
        return [...without, { date, weight }].sort((a, b) => a.date.localeCompare(b.date));
      });
      try {
        await db.upsertWeightEntry(userId, date, weight);
      } catch (e) {
        console.error('Save weight failed:', e);
        setWeightEntries(await db.fetchWeightEntries(userId, 365));
      }
    },
    [userId],
  );

  const removeWeight = useCallback(
    async (date) => {
      setWeightEntries((prev) => prev.filter((w) => w.date !== date));
      try {
        await db.deleteWeightEntry(userId, date);
      } catch (e) {
        console.error('Delete weight failed:', e);
        setWeightEntries(await db.fetchWeightEntries(userId, 365));
      }
    },
    [userId],
  );

  // ---- body measurements --------------------------------------------------

  const saveMeasurement = useCallback(
    async (date, metric, value, unit) => {
      setMeasurements((prev) => {
        const without = prev.filter((m) => !(m.date === date && m.metric === metric));
        return [...without, { id: `tmp-${date}-${metric}`, date, metric, value, unit }].sort(
          (a, b) => a.date.localeCompare(b.date),
        );
      });
      try {
        const saved = await db.upsertMeasurement(userId, date, metric, value, unit);
        setMeasurements((prev) =>
          prev.map((m) => (m.date === date && m.metric === metric ? saved : m)),
        );
      } catch (e) {
        console.error('Save measurement failed:', e);
        setMeasurements(await db.fetchMeasurements(userId, 365));
      }
    },
    [userId],
  );

  const removeMeasurement = useCallback(
    async (date, metric) => {
      setMeasurements((prev) => prev.filter((m) => !(m.date === date && m.metric === metric)));
      try {
        await db.deleteMeasurement(userId, date, metric);
      } catch (e) {
        console.error('Delete measurement failed:', e);
        setMeasurements(await db.fetchMeasurements(userId, 365));
      }
    },
    [userId],
  );

  const value = {
    userId,
    loading,
    loadError,
    exercises,
    exerciseById,
    routines,
    history,
    activeWorkout,
    weightEntries,
    measurements,
    personalRecords,
    createExercise,
    editExercise,
    removeExercise,
    saveRoutine,
    removeRoutine,
    beginWorkout,
    refreshActiveWorkout,
    patchActiveWorkout,
    endWorkout,
    discardWorkout,
    renameActiveWorkout,
    patchHistoryWorkout,
    editWorkout,
    removeWorkout,
    saveWeight,
    removeWeight,
    saveMeasurement,
    removeMeasurement,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
