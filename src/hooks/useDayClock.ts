import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { msUntilNext } from '@/logic/dates';
import { useAppStore } from '@/store/useAppStore';

/**
 * Keeps day/mode in sync while running (spec 3.5): full rollover on
 * AppState active (iOS suspends JS timers in the background), commits
 * the pending Undo batch on backgrounding (spec 3.2 v4), and arms
 * in-foreground timers to the next day-end (E) and planning time (P).
 * Re-arms on schedule changes.
 */
export function useDayClock() {
  const dayEndTime = useAppStore((s) => s.settings.dayEndTime);
  const planningTime = useAppStore((s) => s.settings.planningTime);
  const runRollover = useAppStore((s) => s.runRollover);
  const refreshMode = useAppStore((s) => s.refreshMode);
  const commitPendingBatch = useAppStore((s) => s.commitPendingBatch);

  const eTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function armTimers() {
      if (eTimer.current) clearTimeout(eTimer.current);
      if (pTimer.current) clearTimeout(pTimer.current);

      const now = new Date();
      eTimer.current = setTimeout(
        () => {
          runRollover();
          armTimers();
        },
        msUntilNext(now, dayEndTime)
      );

      pTimer.current = setTimeout(
        () => {
          refreshMode();
          armTimers();
        },
        msUntilNext(now, planningTime)
      );
    }

    armTimers();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        runRollover();
        armTimers();
      } else if (state === 'background') {
        commitPendingBatch();
      }
    });

    return () => {
      if (eTimer.current) clearTimeout(eTimer.current);
      if (pTimer.current) clearTimeout(pTimer.current);
      subscription.remove();
    };
  }, [dayEndTime, planningTime, runRollover, refreshMode, commitPendingBatch]);
}
