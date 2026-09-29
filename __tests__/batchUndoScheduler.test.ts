import { BatchUndoScheduler } from '@/logic/batchUndoScheduler';

// Spec 3.2 v4 (TASK_FIXES_06/07): batch undo. Each swipe adds to one
// pending batch and restarts the UNDO_WINDOW_MS timer; Undo restores all
// of them; the timeout (or an explicit commit) deletes all of them.

type FakeTask = { id: string };

function task(id: string): FakeTask {
  return { id };
}

const WINDOW_MS = 2000;

describe('BatchUndoScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('swipe A, B, C, then cancel (Undo): all three come back, onCommit never called', () => {
    const onCommit = jest.fn();
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, onCommit);

    scheduler.add(task('A'));
    scheduler.add(task('B'));
    scheduler.add(task('C'));

    expect(scheduler.current?.tasks.map((t) => t.id)).toEqual(['A', 'B', 'C']);

    scheduler.cancel();

    expect(scheduler.current).toBeNull();
    expect(onCommit).not.toHaveBeenCalled();

    // The timer must be cancelled too -- nothing should fire later.
    jest.advanceTimersByTime(WINDOW_MS + 100);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('swipe A, then B, then let the timeout fire: both are committed together', () => {
    const onCommit = jest.fn();
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, onCommit);

    scheduler.add(task('A'));
    jest.advanceTimersByTime(500);
    scheduler.add(task('B'));

    jest.advanceTimersByTime(WINDOW_MS);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith([task('A'), task('B')]);
    expect(scheduler.current).toBeNull();
  });

  it('a swipe at 1.5s restarts the timer, so the first task is not committed at the original 2s mark', () => {
    const onCommit = jest.fn();
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, onCommit);

    scheduler.add(task('A')); // t=0, would time out at t=2000 if untouched
    jest.advanceTimersByTime(1500); // t=1500
    scheduler.add(task('B')); // restarts the countdown: now times out at t=3500

    jest.advanceTimersByTime(500); // t=2000 -- the original deadline
    expect(onCommit).not.toHaveBeenCalled();
    expect(scheduler.current?.tasks.map((t) => t.id)).toEqual(['A', 'B']);

    jest.advanceTimersByTime(1500); // t=3500 -- the restarted deadline
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith([task('A'), task('B')]);
  });

  it('bumps version on every add, so the UI can detect "a new task joined" (the Undo button ring restart)', () => {
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, jest.fn());

    scheduler.add(task('A'));
    const firstVersion = scheduler.current?.version;

    scheduler.add(task('B'));
    const secondVersion = scheduler.current?.version;

    expect(firstVersion).toBeDefined();
    expect(secondVersion).toBeDefined();
    expect(secondVersion).not.toBe(firstVersion);
  });

  it('commit() with nothing pending is a harmless no-op', () => {
    const onCommit = jest.fn();
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, onCommit);

    scheduler.commit();

    expect(onCommit).not.toHaveBeenCalled();
    expect(scheduler.current).toBeNull();
  });

  it('cancel() with nothing pending is a harmless no-op', () => {
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, jest.fn());
    expect(() => scheduler.cancel()).not.toThrow();
    expect(scheduler.current).toBeNull();
  });

  it('an explicit commit() (e.g. rollover/backgrounding) fires immediately without waiting for the timer', () => {
    const onCommit = jest.fn();
    const scheduler = new BatchUndoScheduler<FakeTask>(WINDOW_MS, onCommit);

    scheduler.add(task('A'));
    scheduler.commit();

    expect(onCommit).toHaveBeenCalledWith([task('A')]);
    expect(scheduler.current).toBeNull();

    // The original timer must not also fire a second commit later.
    jest.advanceTimersByTime(WINDOW_MS + 100);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
