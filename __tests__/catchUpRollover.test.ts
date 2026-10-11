import * as tasksRepo from '@/db/tasksRepo';
import { OPEN_TASK_LIMIT } from '@/logic/limits';
import { useAppStore } from '@/store/useAppStore';
import { getAllFakeTasks, resetFakeRepos } from './testUtils/fakeRepos';

// Rollover through the real store, against the in-memory fake repos (spec
// 3.5 v9). "Now" is pinned to Wednesday 2026-10-07 10:00 (day mode, default
// schedule), so Tuesday is the 6th and Monday the 5th.
const MON = '2026-10-05';
const TUE = '2026-10-06';
const WED = '2026-10-07';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 7, 10, 0));
});

afterEach(() => {
  jest.useRealTimers();
});

function textsLeft(): string[] {
  return getAllFakeTasks().map((t) => t.text);
}

describe('runRollover with Keep unplanned tasks ON (the default)', () => {
  it('keeps leftovers from an undecided day as catch-up tasks, outside Today and Tomorrow', () => {
    resetFakeRepos();
    tasksRepo.add(TUE, 'Call bank');
    tasksRepo.add(TUE, 'Water plants');
    tasksRepo.add(WED, 'Already today');

    useAppStore.getState().init();

    const state = useAppStore.getState();
    expect(state.catchUpTasks.map((t) => t.text)).toEqual(['Call bank', 'Water plants']);
    expect(state.todayTasks.map((t) => t.text)).toEqual(['Already today']);
    expect(state.tomorrowTasks).toEqual([]);
    expect(textsLeft()).toEqual(['Call bank', 'Water plants', 'Already today']);
  });

  it('deletes a day the user decided about (Move N / Let them go that evening)', () => {
    resetFakeRepos({ lastCarryPromptDate: TUE });
    tasksRepo.add(TUE, 'Left behind on purpose');

    useAppStore.getState().init();

    expect(useAppStore.getState().catchUpTasks).toEqual([]);
    expect(textsLeft()).toEqual([]);
  });

  it('decided Monday, tasks planned for Tuesday, opened Wednesday: Monday goes, Tuesday waits', () => {
    resetFakeRepos({ lastCarryPromptDate: MON });
    tasksRepo.add(MON, 'Decided leftover');
    tasksRepo.add(TUE, 'Planned for Tuesday');

    useAppStore.getState().init();

    expect(useAppStore.getState().catchUpTasks.map((t) => t.text)).toEqual(['Planned for Tuesday']);
    expect(textsLeft()).toEqual(['Planned for Tuesday']);
  });

  it('orders catch-up tasks by day, then position', () => {
    resetFakeRepos();
    tasksRepo.add(TUE, 'Tue 1');
    tasksRepo.add(MON, 'Mon 1');
    tasksRepo.add(TUE, 'Tue 2');
    tasksRepo.add(MON, 'Mon 2');

    useAppStore.getState().init();

    expect(useAppStore.getState().catchUpTasks.map((t) => t.text)).toEqual(['Mon 1', 'Mon 2', 'Tue 1', 'Tue 2']);
  });

  it("never purges today's own tasks, even when today is the decided day (a later rollover the same evening)", () => {
    resetFakeRepos({ lastCarryPromptDate: WED });
    tasksRepo.add(WED, 'Still today');

    useAppStore.getState().init();
    useAppStore.getState().runRollover();

    expect(textsLeft()).toEqual(['Still today']);
  });

  it("catch-up tasks don't count toward the 10-task limit", () => {
    resetFakeRepos();
    for (let i = 0; i < OPEN_TASK_LIMIT; i++) tasksRepo.add(TUE, `Old ${i}`);

    useAppStore.getState().init();

    expect(useAppStore.getState().catchUpTasks).toHaveLength(OPEN_TASK_LIMIT);
    expect(useAppStore.getState().addTask('today', 'Fresh')).toBe(true);
  });
});

describe('runRollover with Keep unplanned tasks OFF (strict, the pre-v9 rule)', () => {
  it('deletes everything from past days, decided or not, and leaves no catch-up tasks', () => {
    resetFakeRepos({ keepUnplanned: false });
    tasksRepo.add(MON, 'Old');
    tasksRepo.add(TUE, 'Older still');
    tasksRepo.add(WED, 'Today stays');

    useAppStore.getState().init();

    expect(useAppStore.getState().catchUpTasks).toEqual([]);
    expect(textsLeft()).toEqual(['Today stays']);
  });
});

describe('turning Keep unplanned tasks off', () => {
  it('runs the rollover, which now purges the waiting catch-up tasks', () => {
    resetFakeRepos();
    tasksRepo.add(TUE, 'Waiting');
    useAppStore.getState().init();
    expect(useAppStore.getState().catchUpTasks).toHaveLength(1);

    useAppStore.getState().updateSchedule({ keepUnplanned: false });

    expect(useAppStore.getState().settings.keepUnplanned).toBe(false);
    expect(useAppStore.getState().catchUpTasks).toEqual([]);
    expect(textsLeft()).toEqual([]);
  });
});
