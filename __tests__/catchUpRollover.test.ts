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
  // The store is a module-level singleton shared by every test in this file,
  // and these sheet flags are only ever cleared by user actions.
  useAppStore.setState({
    catchUpTasks: [],
    catchUpDue: false,
    catchUpSheetVisible: false,
    carryPromptDue: false,
    carrySheetVisible: false,
  });
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

describe('catch-up actions (spec 3.5 v9)', () => {
  function state() {
    return useAppStore.getState();
  }

  it('Keep N moves the selected tasks to Today, appended in day order with counter +1, and deletes the rest', () => {
    resetFakeRepos();
    tasksRepo.add(WED, 'Already today');
    const tueTask = tasksRepo.add(TUE, 'Tuesday leftover');
    const monTask = tasksRepo.add(MON, 'Monday leftover');
    tasksRepo.add(MON, 'Not chosen');
    state().init();

    state().keepCatchUpTasks([tueTask.id, monTask.id]);

    // Monday's task goes first even though it was selected second: day, then position.
    expect(state().todayTasks.map((t) => [t.text, t.carryCount])).toEqual([
      ['Already today', 0],
      ['Monday leftover', 1],
      ['Tuesday leftover', 1],
    ]);
    expect(state().catchUpTasks).toEqual([]);
    // The raw table isn't in list order (that's what todayTasks above checks) -- just that nothing else survived.
    expect([...textsLeft()].sort()).toEqual(['Already today', 'Monday leftover', 'Tuesday leftover']);
    expect(state().catchUpSheetVisible).toBe(false);
  });

  it('a catch-up counts once however many days were missed', () => {
    resetFakeRepos();
    const old = tasksRepo.add(MON, 'Three days ago'); // opened on Wednesday: Monday and Tuesday were both missed
    tasksRepo.setCarryCount(old.id, 2);
    state().init();

    state().keepCatchUpTasks([old.id]);

    expect(state().todayTasks.map((t) => t.carryCount)).toEqual([3]);
  });

  it('follows the duplicate rule: same text as a Today task merges into it, with max(existing, moved + 1)', () => {
    resetFakeRepos();
    const existing = tasksRepo.add(WED, 'Call bank');
    tasksRepo.setCarryCount(existing.id, 4);
    const leftover = tasksRepo.add(TUE, 'Call bank');
    tasksRepo.setCarryCount(leftover.id, 1);
    state().init();

    state().keepCatchUpTasks([leftover.id]);

    expect(state().todayTasks.map((t) => [t.text, t.carryCount])).toEqual([['Call bank', 4]]);
    expect(textsLeft()).toEqual(['Call bank']);
  });

  it("a x5 task can't be kept even if passed in -- it goes with the rest", () => {
    resetFakeRepos();
    const stuck = tasksRepo.add(TUE, 'Stuck');
    tasksRepo.setCarryCount(stuck.id, 5);
    state().init();

    state().keepCatchUpTasks([stuck.id]);

    expect(state().todayTasks).toEqual([]);
    expect(textsLeft()).toEqual([]);
  });

  it('Let them go deletes every catch-up task and leaves Today alone', () => {
    resetFakeRepos();
    tasksRepo.add(WED, 'Today stays');
    tasksRepo.add(MON, 'Gone 1');
    tasksRepo.add(TUE, 'Gone 2');
    state().init();

    state().letCatchUpTasksGo();

    expect(state().catchUpTasks).toEqual([]);
    expect(textsLeft()).toEqual(['Today stays']);
    expect(state().catchUpSheetVisible).toBe(false);
  });

  it('a backdrop dismiss deletes nothing, and the sheet is raised again on the next app open', () => {
    resetFakeRepos();
    tasksRepo.add(TUE, 'Waiting');
    state().init();
    state().showCarrySheetIfDue();
    expect(state().catchUpSheetVisible).toBe(true);

    state().hideCatchUpSheet();

    expect(state().catchUpSheetVisible).toBe(false);
    expect(state().catchUpDue).toBe(false);
    expect(textsLeft()).toEqual(['Waiting']);
    expect(state().catchUpTasks).toHaveLength(1);

    state().runRollover(); // AppState -> active: the next app open

    expect(state().catchUpDue).toBe(true);
  });

  it("changing a setting isn't an app open: it doesn't re-raise a sheet the user dismissed", () => {
    resetFakeRepos();
    tasksRepo.add(TUE, 'Waiting');
    state().init();
    state().showCarrySheetIfDue();
    state().hideCatchUpSheet();

    state().updateSchedule({ reminderEnabled: false });

    expect(state().catchUpDue).toBe(false);
    expect(textsLeft()).toEqual(['Waiting']);
  });

  it('never writes lastCarryPromptDate -- only the evening Move N / Let them go is a decision', () => {
    resetFakeRepos();
    tasksRepo.add(MON, 'A');
    tasksRepo.add(TUE, 'B');
    state().init();

    state().showCarrySheetIfDue();
    state().hideCatchUpSheet();
    state().keepCatchUpTasks([]);
    state().letCatchUpTasksGo();

    expect(state().settings.lastCarryPromptDate).toBeNull();
  });

  it('with nothing waiting there is no catch-up sheet to raise', () => {
    resetFakeRepos();
    tasksRepo.add(WED, 'Only today');

    state().init();

    expect(state().catchUpDue).toBe(false);
    state().showCarrySheetIfDue();
    expect(state().catchUpSheetVisible).toBe(false);
  });
});

describe('both sheets due (spec 3.5 v9: catch-up first, then the evening sheet)', () => {
  function state() {
    return useAppStore.getState();
  }

  function setUpBothDue() {
    jest.setSystemTime(new Date(2026, 9, 7, 20, 30)); // Wednesday evening: planning mode
    resetFakeRepos();
    tasksRepo.add(TUE, 'Missed leftover');
    tasksRepo.add(WED, 'Unfinished today');
    state().init();
    expect(state().catchUpDue).toBe(true);
    expect(state().carryPromptDue).toBe(true);
  }

  it('shows the catch-up sheet first and holds the evening sheet back', () => {
    setUpBothDue();

    state().showCarrySheetIfDue();

    expect(state().catchUpSheetVisible).toBe(true);
    expect(state().carrySheetVisible).toBe(false);

    state().showCarrySheetIfDue(); // still open -- must not stack the evening sheet on top
    expect(state().carrySheetVisible).toBe(false);
  });

  it('the evening sheet follows once the catch-up sheet closes', () => {
    setUpBothDue();
    state().showCarrySheetIfDue();

    state().hideCatchUpSheet();
    state().showCarrySheetIfDue();

    expect(state().catchUpSheetVisible).toBe(false);
    expect(state().carrySheetVisible).toBe(true);
  });

  it("Keep N re-evaluates the evening prompt: Today's new tasks can make it due", () => {
    jest.setSystemTime(new Date(2026, 9, 7, 20, 30));
    resetFakeRepos();
    const leftover = tasksRepo.add(TUE, 'Missed leftover');
    state().init();
    expect(state().carryPromptDue).toBe(false); // Today is empty: nothing to move yet

    state().keepCatchUpTasks([leftover.id]);

    expect(state().carryPromptDue).toBe(true);
  });
});

describe('the evening decision (spec 3.5 v9)', () => {
  function state() {
    return useAppStore.getState();
  }

  it('Let them go in the evening, then the next morning: no catch-up sheet, the leftovers are gone', () => {
    jest.setSystemTime(new Date(2026, 9, 6, 20, 30)); // Tuesday evening
    resetFakeRepos();
    tasksRepo.add(TUE, 'Left on purpose');
    state().init();
    state().skipCarrySheet(); // the evening "Let them go": a decision

    jest.setSystemTime(new Date(2026, 9, 7, 9, 0)); // Wednesday morning
    state().runRollover();

    expect(state().catchUpTasks).toEqual([]);
    expect(state().catchUpDue).toBe(false);
    expect(textsLeft()).toEqual([]);
  });

  it('skipping the evening entirely: the next morning the leftovers are offered instead', () => {
    jest.setSystemTime(new Date(2026, 9, 6, 20, 30)); // Tuesday evening, app never decided
    resetFakeRepos();
    tasksRepo.add(TUE, 'Never decided');
    state().init();

    jest.setSystemTime(new Date(2026, 9, 7, 9, 0)); // Wednesday morning
    state().runRollover();

    expect(state().catchUpTasks.map((t) => t.text)).toEqual(['Never decided']);
    expect(state().catchUpDue).toBe(true);
  });
});
