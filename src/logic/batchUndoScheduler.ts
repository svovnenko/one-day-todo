/**
 * Manages the pending-undo batch's timer lifecycle (spec 3.2 v4): each
 * `add()` appends a task to the batch and restarts the countdown from
 * `windowMs`; the batch commits (via `onCommit`) either when that timer
 * fires or when `commit()` is called explicitly (rollover, backgrounding).
 * `cancel()` (Undo) clears the batch without committing.
 *
 * Deliberately has no SQLite/store dependency -- it only schedules
 * setTimeout/clearTimeout and hands the accumulated tasks to `onCommit`,
 * so it's fully unit-testable with jest fake timers (see
 * __tests__/batchUndoScheduler.test.ts). useAppStore.ts owns one instance
 * per app run and wires `onCommit` to the real deletes + a state sync.
 */
export class BatchUndoScheduler<T extends { id: string }> {
  private tasks: T[] = [];
  private version = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly windowMs: number,
    private readonly onCommit: (tasks: T[]) => void
  ) {}

  /** The current batch, or null if nothing is pending. */
  get current(): { tasks: T[]; version: number } | null {
    return this.timeoutId === null ? null : { tasks: this.tasks, version: this.version };
  }

  /** Adds a task to the batch (starting one if none is pending) and restarts the countdown. */
  add(task: T): void {
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    this.tasks = [...this.tasks, task];
    this.version += 1;
    this.timeoutId = setTimeout(() => this.commit(), this.windowMs);
  }

  /** Cancels the timer and clears the batch without committing (Undo). */
  cancel(): void {
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    this.tasks = [];
  }

  /** Commits the batch now via `onCommit` and clears it. Safe to call with nothing pending (no-op). */
  commit(): void {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    const tasks = this.tasks;
    this.timeoutId = null;
    this.tasks = [];
    this.onCommit(tasks);
  }
}
