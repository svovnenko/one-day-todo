import { isPlanningMode, todayKey, tomorrowKey } from '@/logic/dates';

export type RolloverSettings = {
  planningTime: string;
  dayEndTime: string;
};

export type RolloverPlan = {
  /** Logical-date key for "today" after this rollover. */
  todayDay: string;
  /** Logical-date key for "tomorrow" after this rollover. */
  tomorrowDay: string;
  /** The mode-default view to reset to (spec 3.1: reset on active / crossing P or E). */
  defaultView: 'today' | 'tomorrow';
};

/**
 * Pure day/mode math for a rollover: given the moment and the schedule
 * settings, what today/tomorrow should be and which view is the default.
 * The actual DB purge and pending-undo commit are side effects performed
 * by the caller (see useAppStore's runRollover) -- this stays pure so it's
 * unit-testable per spec section 6's rule.
 */
export function planRollover(now: Date, settings: RolloverSettings): RolloverPlan {
  const todayDay = todayKey(now, settings.dayEndTime);
  const tomorrowDay = tomorrowKey(now, settings.dayEndTime);
  const defaultView: 'today' | 'tomorrow' = isPlanningMode(now, settings.planningTime, settings.dayEndTime)
    ? 'tomorrow'
    : 'today';
  return { todayDay, tomorrowDay, defaultView };
}
