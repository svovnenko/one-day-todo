import { freeSlots, isListFull, MAX_CARRY_COUNT, MAX_TASK_LENGTH, OPEN_TASK_LIMIT } from '@/logic/limits';

describe('isListFull', () => {
  it('is false below the limit', () => {
    expect(isListFull(0)).toBe(false);
    expect(isListFull(OPEN_TASK_LIMIT - 1)).toBe(false);
  });

  it('is true once the limit is reached', () => {
    expect(isListFull(OPEN_TASK_LIMIT)).toBe(true);
    expect(isListFull(OPEN_TASK_LIMIT + 1)).toBe(true);
  });

  it('a task in the pending Undo batch still counts toward the limit', () => {
    // The store passes todayTasks.length/tomorrowTasks.length here, which
    // already includes any task in the pending batch (it's never deleted
    // from SQLite until the batch commits) -- so a list at exactly 9
    // "committed" tasks plus 1 pending-batch task (10 total, still in
    // SQLite) is correctly full.
    const committedTasks = 9;
    const pendingBatchTasks = 1;
    expect(isListFull(committedTasks + pendingBatchTasks)).toBe(true);
  });

  it('a slot frees once the batch commits and the task is actually gone', () => {
    // Before commit: 9 committed + 1 pending = 10, full.
    expect(isListFull(9 + 1)).toBe(true);
    // After commitPendingBatch() deletes it and refreshTasks() re-reads:
    // just the 9 committed tasks remain, no longer full.
    expect(isListFull(9)).toBe(false);
  });
});

describe('freeSlots', () => {
  it('counts down from the limit', () => {
    expect(freeSlots(0)).toBe(OPEN_TASK_LIMIT);
    expect(freeSlots(7)).toBe(3);
  });

  it('never goes negative for an already-over-the-limit list', () => {
    expect(freeSlots(OPEN_TASK_LIMIT)).toBe(0);
    expect(freeSlots(OPEN_TASK_LIMIT + 5)).toBe(0);
  });
});

it('MAX_CARRY_COUNT is 5 (spec 3.4 v5)', () => {
  expect(MAX_CARRY_COUNT).toBe(5);
});

it('MAX_TASK_LENGTH is 60 (spec 3.2 v8)', () => {
  expect(MAX_TASK_LENGTH).toBe(60);
});
