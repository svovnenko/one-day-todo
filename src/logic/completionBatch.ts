export type CompletionState = 'pending' | 'hidden';

/**
 * Owns the pending-undo batch's timer (spec 3.2) and per-task state --
 * 'pending' (animating) or 'hidden' (finished), plus a restoreVersion
 * bumped on Undo so a restored row remounts fresh rather than reversing
 * a part-finished animation in place.
 *
 * No SQLite/store dependency, so it's unit-testable with fake timers;
 * useAppStore.ts owns one instance and wires onCommit to the real deletes.
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

  /** The row's animation finished. No-op if the task isn't in the batch any more (already restored, or already committed). */
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
