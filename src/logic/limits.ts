/** Spec 3.2/3.4 v5: hard limits on task counts. */
export const OPEN_TASK_LIMIT = 10;
export const MAX_CARRY_COUNT = 5;
/** Spec 3.2 v8: new tasks are capped at 60 characters -- existing longer tasks are kept as-is, never truncated. */
export const MAX_TASK_LENGTH = 60;

/**
 * True once a list (Today or Tomorrow) has reached the open-task limit.
 *
 * `openTaskCount` should be exactly what the store's
 * todayTasks.length/tomorrowTasks.length already are: every task
 * currently in that logical day's SQLite rows. That count already
 * includes any task in the pending Undo batch -- batch tasks are never
 * deleted from SQLite (and so never leave listByDay()'s results) until
 * the batch actually commits -- so passing it straight through correctly
 * counts pending-batch tasks against the limit, with no separate
 * bookkeeping needed. A slot frees itself the moment commitPendingBatch()
 * deletes them for real and refreshTasks() re-reads the shorter list.
 */
export function isListFull(openTaskCount: number): boolean {
  return openTaskCount >= OPEN_TASK_LIMIT;
}

/** How many more tasks a list can hold before it's full (never negative). */
export function freeSlots(openTaskCount: number): number {
  return Math.max(0, OPEN_TASK_LIMIT - openTaskCount);
}
