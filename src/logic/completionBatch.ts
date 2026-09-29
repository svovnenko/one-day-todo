export type CompletionState = 'pending' | 'hidden';

/**
 * Owns the pending-undo batch's timer lifecycle (spec 3.2) AND, per task,
 * whether its row is still animating out ('pending') or has fully
 * finished and is just waiting for the batch to resolve ('hidden') --
 * plus a `restoreVersion` per task, bumped on Undo so a restored row's
 * component remounts fresh instead of trying to reverse a part-finished
 * animation in place.
 *
 * Each `add()` appends a task to the batch (marking it 'pending') and
 * restarts the countdown from `windowMs`; the batch commits (via
 * `onCommit`, clearing those tasks' completion entries first) either when
 * that timer fires or when `commit()` is called explicitly (rollover,
 * backgrounding). `cancel()` (Undo) clears the batch without committing,
 * dropping its tasks' completion entries and bumping their restore
 * versions instead.
 *
 * Deliberately has no SQLite/store dependency -- it only schedules
 * setTimeout/clearTimeout and hands the accumulated tasks to `onCommit`,
 * so it's fully unit-testable with jest fake timers (see
 * __tests__/completionBatch.test.ts). useAppStore.ts owns one instance
 * per app run and wires `onCommit` to the real deletes + a state sync.
 */
export class CompletionBatch<T extends { id: string }> {
  private tasks: T[] = [];
  private version = 0;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private completionState: Record<string, CompletionState> = {};
  private restoreVersionState: Record<string, number> = {};

  constructor(
    private readonly windowMs: number,
    private readonly onCommit: (tasks: T[]) => void
  ) {}

  /** The current batch, or null if nothing is pending. */
  get current(): { tasks: T[]; version: number } | null {
    return this.timeoutId === null ? null : { tasks: this.tasks, version: this.version };
  }

  /** Per-task completion state -- present only for tasks currently in the batch. */
  get completion(): Readonly<Record<string, CompletionState>> {
    return this.completionState;
  }

  /** Per-task restore counter, bumped by `cancel()` (Undo). Persists across batches. */
  get restoreVersion(): Readonly<Record<string, number>> {
    return this.restoreVersionState;
  }

  /** Adds a task to the batch (starting one if none is pending), marks it 'pending', and restarts the countdown. */
  add(task: T): void {
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    this.tasks = [...this.tasks, task];
    this.completionState = { ...this.completionState, [task.id]: 'pending' };
    this.version += 1;
    this.timeoutId = setTimeout(() => this.commit(), this.windowMs);
  }

  /**
   * The row's own completion animation has finished. A no-op if the task
   * isn't in the batch any more (already restored by Undo, or the batch
   * already committed some other way -- both harmless, since there's
   * nothing left to mark).
   */
  markHidden(taskId: string): void {
    if (this.completionState[taskId] === undefined || this.completionState[taskId] === 'hidden') return;
    this.completionState = { ...this.completionState, [taskId]: 'hidden' };
  }

  /** Cancels the timer, clears the batch without committing, and bumps every affected task's restore version (Undo). */
  cancel(): void {
    if (this.timeoutId !== null) clearTimeout(this.timeoutId);
    this.timeoutId = null;
    const ids = this.tasks.map((t) => t.id);
    this.tasks = [];
    const nextCompletion = { ...this.completionState };
    const nextVersions = { ...this.restoreVersionState };
    for (const id of ids) {
      delete nextCompletion[id];
      nextVersions[id] = (nextVersions[id] ?? 0) + 1;
    }
    this.completionState = nextCompletion;
    this.restoreVersionState = nextVersions;
  }

  /** Commits the batch now via `onCommit` and clears it. Safe to call with nothing pending (no-op). */
  commit(): void {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    const tasks = this.tasks;
    this.timeoutId = null;
    this.tasks = [];
    const nextCompletion = { ...this.completionState };
    for (const t of tasks) delete nextCompletion[t.id];
    this.completionState = nextCompletion;
    this.onCommit(tasks);
  }
}
