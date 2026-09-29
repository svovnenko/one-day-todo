import type { Task } from '@/db/tasksRepo';

/**
 * Spec 3.4/4 v6: a committed batch earns "Done for today." only if at
 * least one of its tasks belonged to today's list -- a batch made up
 * entirely of tomorrow-view swipes doesn't count, and neither does Undo
 * (which cancels the batch before it ever reaches a commit).
 */
export function batchCompletesToday(committedTasks: Pick<Task, 'day'>[], todayDay: string): boolean {
  return committedTasks.some((t) => t.day === todayDay);
}
