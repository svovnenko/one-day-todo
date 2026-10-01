import type { Task } from '@/db/tasksRepo';

/**
 * True when two rows carry the same visible data (id, text, position,
 * carryCount). `day`/`createdAt` are excluded -- `day` only changes
 * together with position/carryCount, and createdAt never changes.
 */
function sameTaskData(a: Task, b: Task): boolean {
  return a.id === b.id && a.text === b.text && a.position === b.position && a.carryCount === b.carryCount;
}

/**
 * Reconciles a freshly-read list against the previous one, reusing each
 * previous object reference wherever its data is unchanged (sameTaskData).
 * Returns `previous` itself if every task was reused.
 *
 * Without this, listByDay() rebuilding fresh objects on every
 * refreshTasks() would defeat React.memo(TaskRow) -- a "new" reference
 * is a "changed" prop by React's shallow comparison, even with identical contents.
 */
export function reconcileTaskList(previous: Task[], next: Task[]): Task[] {
  const previousById = new Map(previous.map((task) => [task.id, task]));
  let allReused = previous.length === next.length;

  const result = next.map((freshTask) => {
    const existing = previousById.get(freshTask.id);
    if (existing && sameTaskData(existing, freshTask)) {
      return existing;
    }
    allReused = false;
    return freshTask;
  });

  return allReused ? previous : result;
}
