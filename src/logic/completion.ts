import type { Task } from '@/db/tasksRepo';
import type { CompletionState } from '@/logic/completionBatch';

/**
 * Spec 3.4/4 v6: a committed batch earns "Done for today." only if at
 * least one of its tasks belonged to today's list -- a batch made up
 * entirely of tomorrow-view swipes doesn't count, and neither does Undo
 * (which cancels the batch before it ever reaches a commit).
 */
export function batchCompletesToday(committedTasks: Pick<Task, 'day'>[], todayDay: string): boolean {
  return committedTasks.some((t) => t.day === todayDay);
}

/**
 * The list minus rows whose completion animation has fully finished --
 * a 'pending' row (still animating out) stays visible; only 'hidden' is
 * removed. This is what the FlatList itself renders.
 */
export function visibleTasks<T extends { id: string }>(tasks: T[], completion: Record<string, CompletionState>): T[] {
  return tasks.filter((t) => completion[t.id] !== 'hidden');
}

/**
 * The list minus every task currently mid-completion (pending OR
 * hidden) -- both are about to be gone, so the carry-over sheet and its
 * fallback link should act as if they're already gone.
 */
export function excludeCompleting<T extends { id: string }>(
  tasks: T[],
  completion: Record<string, CompletionState>
): T[] {
  return tasks.filter((t) => completion[t.id] === undefined);
}
