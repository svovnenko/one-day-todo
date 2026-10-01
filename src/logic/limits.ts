/** Spec 3.2/3.4 v5: hard limits on task counts. */
export const OPEN_TASK_LIMIT = 10;
export const MAX_CARRY_COUNT = 5;
/** Spec 3.2 v8: new tasks are capped at 60 characters -- existing longer tasks are kept as-is, never truncated. */
export const MAX_TASK_LENGTH = 60;

/**
 * True once a list has reached the open-task limit. Pending-batch tasks
 * count toward it -- they're never deleted from SQLite until the batch
 * commits, so they never leave listByDay()'s results either.
 */
export function isListFull(openTaskCount: number): boolean {
  return openTaskCount >= OPEN_TASK_LIMIT;
}

/** How many more tasks a list can hold before it's full (never negative). */
export function freeSlots(openTaskCount: number): number {
  return Math.max(0, OPEN_TASK_LIMIT - openTaskCount);
}
