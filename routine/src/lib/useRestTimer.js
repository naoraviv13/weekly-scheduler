import { useEffect, useRef, useState } from 'react';

export const REST_PRESETS = [60, 90, 120, 180];

/**
 * Owns the rest countdown. Deadline-based rather than decrement-based so the
 * timer stays accurate when the tab is backgrounded and interval ticks are
 * throttled by the browser.
 */
export function useRestTimer(defaultDuration = 90) {
  const [remaining, setRemaining] = useState(null);
  const [duration, setDuration] = useState(defaultDuration);
  const [running, setRunning] = useState(false);
  const deadlineRef = useRef(null);

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => {
      const left = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (left <= 0) {
        deadlineRef.current = null;
        setRemaining(null);
        setRunning(false);
      } else {
        setRemaining(left);
      }
    };
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = (secs = duration) => {
    deadlineRef.current = Date.now() + secs * 1000;
    setRemaining(secs);
    setRunning(true);
  };

  const extend = (secs) => {
    if (deadlineRef.current === null) return;
    deadlineRef.current += secs * 1000;
    setRemaining(Math.ceil((deadlineRef.current - Date.now()) / 1000));
  };

  const skip = () => {
    deadlineRef.current = null;
    setRemaining(null);
    setRunning(false);
  };

  return { remaining, start, extend, skip, duration, setDuration };
}
