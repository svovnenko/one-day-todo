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
  /** Whether we're currently in day mode or planning mode (spec 3.1). */
  mode: 'day' | 'planning';
  /** The mode-default view to reset to (spec 3.1: reset on active / crossing P or E). */
  defaultView: 'today' | 'tomorrow';
};

/**
 * Pure day/mode math for a rollover -- the DB purge and pending-undo
 * commit are side effects the caller performs (useAppStore's
 * runRollover). Kept pure so it's unit-testable (spec section 6).
 */
export function planRollover(now: Date, settings: RolloverSettings): RolloverPlan {
  const todayDay = todayKey(now, settings.dayEndTime);
  const tomorrowDay = tomorrowKey(now, settings.dayEndTime);
  const planning = isPlanningMode(now, settings.planningTime, settings.dayEndTime);
  return {
    todayDay,
    tomorrowDay,
    mode: planning ? 'planning' : 'day',
    defaultView: planning ? 'tomorrow' : 'today',
  };
}
