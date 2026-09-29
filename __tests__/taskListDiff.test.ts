import { reconcileTaskList } from '@/logic/taskListDiff';
import type { Task } from '@/db/tasksRepo';

// Spec OPT-01: refreshTasks() must not hand out fresh object references
// for tasks whose visible data hasn't actually changed, or
// React.memo(TaskRow) can't skip re-rendering them.

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    text: 'Call bank',
    day: '2026-09-29',
    position: 1,
    carryCount: 0,
    createdAt: 1000,
    ...overrides,
  };
}

describe('reconcileTaskList', () => {
  it('returns the previous array itself when nothing changed', () => {
    const previous = [makeTask({ id: 'a' }), makeTask({ id: 'b', position: 2 })];
    // A structurally-identical but freshly-built list, as listByDay() would produce.
    const next = [makeTask({ id: 'a' }), makeTask({ id: 'b', position: 2 })];

    const result = reconcileTaskList(previous, next);

    expect(result).toBe(previous);
  });

  it('reuses the same object reference for each unchanged task', () => {
    const taskA = makeTask({ id: 'a' });
    const taskB = makeTask({ id: 'b', position: 2 });
    const previous = [taskA, taskB];
    const next = [makeTask({ id: 'a' }), makeTask({ id: 'b', position: 2 })];

    const result = reconcileTaskList(previous, next);

    expect(result[0]).toBe(taskA);
    expect(result[1]).toBe(taskB);
  });

  it('uses the fresh object for a task whose text changed, but reuses the rest', () => {
    const taskA = makeTask({ id: 'a' });
    const taskB = makeTask({ id: 'b', position: 2 });
    const previous = [taskA, taskB];
    const freshA = makeTask({ id: 'a', text: 'Call bank (updated)' });
    const next = [freshA, makeTask({ id: 'b', position: 2 })];

    const result = reconcileTaskList(previous, next);

    expect(result[0]).toBe(freshA);
    expect(result[1]).toBe(taskB);
    expect(result).not.toBe(previous);
  });

  it('uses the fresh object for a task whose position or carryCount changed', () => {
    const taskA = makeTask({ id: 'a', position: 1, carryCount: 0 });
    const previous = [taskA];
    const movedA = makeTask({ id: 'a', position: 1, carryCount: 1 });

    const result = reconcileTaskList(previous, [movedA]);

    expect(result[0]).toBe(movedA);
  });

  it('a brand-new task (added) is included as-is, previous tasks still reused', () => {
    const taskA = makeTask({ id: 'a' });
    const previous = [taskA];
    const brandNewB = makeTask({ id: 'b', position: 2 });
    const next = [makeTask({ id: 'a' }), brandNewB];

    const result = reconcileTaskList(previous, next);

    expect(result[0]).toBe(taskA);
    expect(result[1]).toBe(brandNewB);
    expect(result).not.toBe(previous);
  });

  it('a removed task is simply absent, remaining tasks still reused', () => {
    const taskA = makeTask({ id: 'a' });
    const taskB = makeTask({ id: 'b', position: 2 });
    const previous = [taskA, taskB];
    const next = [makeTask({ id: 'a' })];

    const result = reconcileTaskList(previous, next);

    expect(result).toHaveLength(1);
    expect(result[0]).toBe(taskA);
  });

  it('handles an empty previous list', () => {
    const next = [makeTask({ id: 'a' })];
    const result = reconcileTaskList([], next);
    expect(result).toEqual(next);
  });

  it('handles an empty next list', () => {
    const previous = [makeTask({ id: 'a' })];
    const result = reconcileTaskList(previous, []);
    expect(result).toEqual([]);
  });
});
