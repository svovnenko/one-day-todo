import { CompletionBatch } from '@/logic/completionBatch';

// Spec 3.2 (batch undo) + the per-task completion/restoreVersion state
// that used to live in app/index.tsx (hiddenRowIds, restoreCounts) before
// REFACTOR-01 moved it here, where it can be driven by fake timers
// exactly like the batch timer itself.

type FakeTask = { id: string };

function task(id: string): FakeTask {
  return { id };
}

const WINDOW_MS = 2000;

describe('CompletionBatch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('batch timing (carried over from the old BatchUndoScheduler)', () => {
    it('swipe A, B, C, then cancel (Undo): all three come back, onCommit never called', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      batch.add(task('B'));
      batch.add(task('C'));

      expect(batch.current?.tasks.map((t) => t.id)).toEqual(['A', 'B', 'C']);

      batch.cancel();

      expect(batch.current).toBeNull();
      expect(onCommit).not.toHaveBeenCalled();

      jest.advanceTimersByTime(WINDOW_MS + 100);
      expect(onCommit).not.toHaveBeenCalled();
    });

    it('swipe A, then B, then let the timeout fire: both are committed together', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      jest.advanceTimersByTime(500);
      batch.add(task('B'));

      jest.advanceTimersByTime(WINDOW_MS);

      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith([task('A'), task('B')]);
      expect(batch.current).toBeNull();
    });

    it('a swipe at 1.5s restarts the timer, so the first task is not committed at the original 2s mark', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      jest.advanceTimersByTime(1500);
      batch.add(task('B'));

      jest.advanceTimersByTime(500);
      expect(onCommit).not.toHaveBeenCalled();
      expect(batch.current?.tasks.map((t) => t.id)).toEqual(['A', 'B']);

      jest.advanceTimersByTime(1500);
      expect(onCommit).toHaveBeenCalledTimes(1);
      expect(onCommit).toHaveBeenCalledWith([task('A'), task('B')]);
    });

    it('bumps version on every add, so the UI can detect "a new task joined" (the Undo button ring restart)', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      batch.add(task('A'));
      const firstVersion = batch.current?.version;

      batch.add(task('B'));
      const secondVersion = batch.current?.version;

      expect(firstVersion).toBeDefined();
      expect(secondVersion).toBeDefined();
      expect(secondVersion).not.toBe(firstVersion);
    });

    it('commit() with nothing pending is a harmless no-op', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.commit();

      expect(onCommit).not.toHaveBeenCalled();
      expect(batch.current).toBeNull();
    });

    it('cancel() with nothing pending is a harmless no-op', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());
      expect(() => batch.cancel()).not.toThrow();
      expect(batch.current).toBeNull();
    });

    it('an explicit commit() (e.g. rollover/backgrounding) fires immediately without waiting for the timer', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      batch.commit();

      expect(onCommit).toHaveBeenCalledWith([task('A')]);
      expect(batch.current).toBeNull();

      jest.advanceTimersByTime(WINDOW_MS + 100);
      expect(onCommit).toHaveBeenCalledTimes(1);
    });
  });

  describe('completion state', () => {
    it('swipe -> hidden -> timeout: the task is committed and its completion entry is cleared', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      expect(batch.completion.A).toBe('pending');

      batch.markHidden('A');
      expect(batch.completion.A).toBe('hidden');

      jest.advanceTimersByTime(WINDOW_MS);
      expect(onCommit).toHaveBeenCalledWith([task('A')]);
      expect(batch.completion.A).toBeUndefined();
    });

    it('swipe -> Undo before the row animation ends: the completion entry clears and restoreVersion bumps', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      batch.add(task('A'));
      expect(batch.completion.A).toBe('pending');

      batch.cancel();

      expect(batch.completion.A).toBeUndefined(); // visible again -- no longer 'hidden' or 'pending'
      expect(batch.restoreVersion.A).toBe(1);
    });

    it('swipe -> hidden -> Undo: the completion entry clears and restoreVersion bumps', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      batch.add(task('A'));
      batch.markHidden('A');
      expect(batch.completion.A).toBe('hidden');

      batch.cancel();

      expect(batch.completion.A).toBeUndefined();
      expect(batch.restoreVersion.A).toBe(1);
    });

    it('batch A, B, C -> Undo: every task in the batch clears and every restoreVersion bumps', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      batch.add(task('A'));
      batch.add(task('B'));
      batch.add(task('C'));
      batch.markHidden('A'); // A finished animating, B and C are still mid-animation

      batch.cancel();

      expect(batch.completion).toEqual({});
      expect(batch.restoreVersion).toEqual({ A: 1, B: 1, C: 1 });
    });

    it('rollover (an explicit commit) during a pending batch: committed, and every completion entry clears', () => {
      const onCommit = jest.fn();
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, onCommit);

      batch.add(task('A'));
      batch.add(task('B'));
      batch.markHidden('B');

      batch.commit();

      expect(onCommit).toHaveBeenCalledWith([task('A'), task('B')]);
      expect(batch.completion).toEqual({});
    });

    it('markHidden for a task no longer in the batch (already restored, or already committed) is a no-op', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      expect(() => batch.markHidden('ghost')).not.toThrow();
      expect(batch.completion.ghost).toBeUndefined();

      batch.add(task('A'));
      batch.cancel(); // A is no longer in the batch
      batch.markHidden('A');
      expect(batch.completion.A).toBeUndefined();
    });

    it('a second Undo restore keeps bumping the same task\'s restoreVersion', () => {
      const batch = new CompletionBatch<FakeTask>(WINDOW_MS, jest.fn());

      batch.add(task('A'));
      batch.cancel();
      expect(batch.restoreVersion.A).toBe(1);

      batch.add(task('A'));
      batch.cancel();
      expect(batch.restoreVersion.A).toBe(2);
    });
  });
});
