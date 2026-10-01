import type { Task } from '@/db/tasksRepo';
import type { CompletionState } from '@/logic/completionBatch';

/** Spec 3.4/4 v6: "Done for today." only if the batch includes a today task -- a tomorrow-only batch, or an Undo (which cancels before commit), doesn't count. */
export function batchCompletesToday(committedTasks: Pick<Task, 'day'>[], todayDay: string): boolean {
  return committedTasks.some((t) => t.day === todayDay);
}

/** The list minus fully-finished rows ('hidden') -- 'pending' (still animating) stays visible. What the FlatList renders. */
export function visibleTasks<T extends { id: string }>(tasks: T[], completion: Record<string, CompletionState>): T[] {
  return tasks.filter((t) => completion[t.id] !== 'hidden');
}

/** The list minus every task mid-completion (pending or hidden) -- both are about to be gone. */
export function excludeCompleting<T extends { id: string }>(
  tasks: T[],
  completion: Record<string, CompletionState>
): T[] {
  return tasks.filter((t) => completion[t.id] === undefined);
}
