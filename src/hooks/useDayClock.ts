import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { msUntilNext } from '@/logic/dates';
import { useAppStore } from '@/store/useAppStore';

/**
 * Keeps the day/mode in sync while the app is running (spec 3.5):
 * - runs the full rollover on AppState becoming active (the day may have
 *   changed while backgrounded, and iOS suspends JS timers in the
 *   background so they can't be relied on there),
 * - arms an in-foreground timer to the next day-end (E) that runs the full
 *   rollover and re-arms itself,
 * - arms an in-foreground timer to the next planning time (P) that flips
 *   the mode default and re-arms itself.
 * Re-arms whenever the schedule settings change (spec 3.6).
 */
export function useDayClock() {
  const dayEndTime = useAppStore((s) => s.settings.dayEndTime);
  const planningTime = useAppStore((s) => s.settings.planningTime);
  const runRollover = useAppStore((s) => s.runRollover);
  const refreshMode = useAppStore((s) => s.refreshMode);

  const eTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function armTimers() {
      if (eTimer.current) clearTimeout(eTimer.current);
      if (pTimer.current) clearTimeout(pTimer.current);

      const now = new Date();
      eTimer.current = setTimeout(() => {
        runRollover();
        armTimers();
      }, msUntilNext(now, dayEndTime));

      pTimer.current = setTimeout(() => {
        refreshMode();
        armTimers();
      }, msUntilNext(now, planningTime));
    }

    armTimers();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runRollover();
        armTimers();
      }
    });

    return () => {
      if (eTimer.current) clearTimeout(eTimer.current);
      if (pTimer.current) clearTimeout(pTimer.current);
      subscription.remove();
    };
  }, [dayEndTime, planningTime, runRollover, refreshMode]);
}
