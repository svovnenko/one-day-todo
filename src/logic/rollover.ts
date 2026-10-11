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

export type PurgePlan = {
  /** Delete every task whose day is strictly before this day key (strict mode). */
  deleteBefore: string | null;
  /** Delete every task on exactly this day (the day the user already decided about). */
  deleteDay: string | null;
};

/**
 * Spec 3.5 v9, "delete by decision, never by accident": which past days a
 * rollover may delete. Keep OFF is the strict pre-v9 rule. Keep ON deletes
 * only the day the user answered the evening sheet for (`Move N` / `Let
 * them go` sets lastCarryPromptDate); every other past day is left as
 * pending catch-up tasks. The `< todayDay` guard matters: during the
 * decided evening itself lastCarryPromptDate === todayDay, and today's
 * tasks must never be purged.
 */
export function planPurge(args: {
  keepUnplanned: boolean;
  todayDay: string;
  lastCarryPromptDate: string | null;
}): PurgePlan {
  if (!args.keepUnplanned) return { deleteBefore: args.todayDay, deleteDay: null };
  const decided = args.lastCarryPromptDate;
  return { deleteBefore: null, deleteDay: decided !== null && decided < args.todayDay ? decided : null };
}

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
