import type { Task } from '@/db/tasksRepo';

/**
 * True when two task rows carry the same visible data (spec OPT-01: id,
 * text, position and carry count -- the fields a row actually renders or
 * that affect list order). `day`/`createdAt` are deliberately excluded:
 * `day` only ever changes together with `position`/`carryCount` (a
 * carry-over move), and `createdAt` never changes after insertion, so
 * comparing them would add nothing.
 */
function sameTaskData(a: Task, b: Task): boolean {
  return a.id === b.id && a.text === b.text && a.position === b.position && a.carryCount === b.carryCount;
}

/**
 * Reconciles a freshly-read task list against the previous one, reusing
 * each previous object reference wherever its data is unchanged (see
 * sameTaskData). If EVERY task ends up reused (same set, same data,
 * same order), returns `previous` itself unchanged.
 *
 * Without this, every refreshTasks() call (e.g. from adding one task)
 * would hand out brand-new objects for every OTHER, unrelated task too --
 * tasksRepo.listByDay() builds fresh objects from SQLite rows every time
 * it's called, whether or not that particular row's data actually
 * changed. That defeats React.memo(TaskRow): a "new" task prop reference
 * (even with identical contents) is, by React's default shallow
 * comparison, a "changed" prop, so the row would still re-render on every
 * unrelated update.
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
