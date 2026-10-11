import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import * as tasksRepo from '@/db/tasksRepo';
import { useAppStore } from '@/store/useAppStore';
import { getAllFakeTasks, resetFakeRepos } from './testUtils/fakeRepos';

// Spec 3.5 v9 at the screen level: the real HomeScreen, store and hooks over
// the in-memory fake repos. Dates: Monday 2026-10-05, Tuesday the 6th and
// Wednesday the 7th -- "now" is Wednesday morning unless a test says otherwise.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useIsFocused: () => true,
}));

const TUE = '2026-10-06';
const WED = '2026-10-07';

function renderHome() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <HomeScreen />
    </SafeAreaProvider>
  );
}

type Screen = Awaited<ReturnType<typeof renderHome>>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date(2026, 9, 7, 9, 0)); // Wednesday morning, day mode
  resetFakeRepos();
  // The store is a module-level singleton; these are only ever cleared by user actions.
  useAppStore.setState({
    catchUpTasks: [],
    catchUpDue: false,
    catchUpSheetVisible: false,
    carryPromptDue: false,
    carrySheetVisible: false,
    pendingBatch: null,
    completion: {},
  });
});

afterEach(() => {
  jest.useRealTimers();
});

function seedLeftovers(day = TUE) {
  tasksRepo.add(day, 'Call bank');
  tasksRepo.add(day, 'Water plants');
  tasksRepo.add(day, 'Email Sam');
}

function rowStates(screen: Screen) {
  return screen.getAllByRole('checkbox').map((row) => row.props.accessibilityState);
}

describe('the catch-up sheet on an app open (spec 3.5 v9)', () => {
  it('undecided leftovers: the sheet appears with all of them, unselected', async () => {
    seedLeftovers();
    const screen = await renderHome();

    expect(await screen.findByText('Left from last time')).toBeTruthy();
    expect(screen.getByText('Call bank')).toBeTruthy();
    expect(screen.getByText('Water plants')).toBeTruthy();
    expect(screen.getByText('Email Sam')).toBeTruthy();
    expect(rowStates(screen).map((s) => s.checked)).toEqual([false, false, false]);
    expect(screen.getByText('Choose what to keep')).toBeTruthy();
  });

  it('Keep 1: that task is in Today with its counter +1, the rest are gone', async () => {
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');

    await fireEvent.press(screen.getByText('Water plants'));
    await fireEvent.press(screen.getByText('Keep 1'));

    expect(screen.queryByText('Left from last time')).toBeNull();
    expect(screen.getByText(/Water plants/)).toBeTruthy();
    expect(screen.getByText(/×1/)).toBeTruthy();
    expect(screen.queryByText('Call bank')).toBeNull();
    expect(screen.queryByText('Email Sam')).toBeNull();
    expect(getAllFakeTasks().map((t) => [t.text, t.day, t.carryCount])).toEqual([['Water plants', WED, 1]]);
    expect(screen.queryByText(/left from last time/)).toBeNull();
  });

  it('Let them go: every leftover is deleted and no footer line is left behind', async () => {
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');

    await fireEvent.press(screen.getByText('Let them go'));

    expect(screen.queryByText('Left from last time')).toBeNull();
    expect(getAllFakeTasks()).toEqual([]);
    expect(screen.queryByText(/left from last time/)).toBeNull();
    expect(screen.getByText('Nothing here. Tap + to add.')).toBeTruthy();
  });

  it('a backdrop tap deletes nothing, leaves the footer line, and the line reopens the sheet', async () => {
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');

    await fireEvent.press(screen.getByTestId('carry-sheet-backdrop'));

    expect(screen.queryByText('Left from last time')).toBeNull();
    expect(getAllFakeTasks()).toHaveLength(3);
    expect(screen.getByText('3 left from last time ›')).toBeTruthy();

    await fireEvent.press(screen.getByText('3 left from last time ›'));

    expect(await screen.findByText('Left from last time')).toBeTruthy();
    expect(rowStates(screen).map((s) => s.checked)).toEqual([false, false, false]);
  });

  it('nothing is raised again by a settings change, but the next app open shows the sheet again', async () => {
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');
    await fireEvent.press(screen.getByTestId('carry-sheet-backdrop'));

    await act(async () => useAppStore.getState().updateSchedule({ reminderEnabled: false }));
    expect(screen.queryByText('Left from last time')).toBeNull();

    await act(async () => useAppStore.getState().runRollover()); // AppState -> active
    expect(await screen.findByText('Left from last time')).toBeTruthy();
  });
});

describe('decisions and the Keep unplanned tasks setting', () => {
  it('an evening Let them go, then the next morning: no catch-up sheet, the leftovers are gone', async () => {
    jest.setSystemTime(new Date(2026, 9, 6, 20, 30)); // Tuesday evening, planning mode
    tasksRepo.add(TUE, 'Left on purpose');
    const evening = await renderHome();
    expect(await evening.findByText('Move unfinished to tomorrow?')).toBeTruthy();
    await fireEvent.press(evening.getByText('Let them go'));
    await evening.unmount();

    jest.setSystemTime(new Date(2026, 9, 7, 9, 0)); // Wednesday morning
    const morning = await renderHome();

    expect(await morning.findByText('Nothing here. Tap + to add.')).toBeTruthy();
    expect(morning.queryByText('Left from last time')).toBeNull();
    expect(morning.queryByText(/left from last time/)).toBeNull();
    expect(getAllFakeTasks()).toEqual([]);
  });

  it('an evening backdrop tap is still a Let them go (spec 3.4 unchanged), so it counts as a decision too', async () => {
    jest.setSystemTime(new Date(2026, 9, 6, 20, 30));
    tasksRepo.add(TUE, 'Left on purpose');
    const evening = await renderHome();
    await evening.findByText('Move unfinished to tomorrow?');
    await fireEvent.press(evening.getByTestId('carry-sheet-backdrop'));
    await evening.unmount();

    jest.setSystemTime(new Date(2026, 9, 7, 9, 0));
    const morning = await renderHome();

    expect(await morning.findByText('Nothing here. Tap + to add.')).toBeTruthy();
    expect(getAllFakeTasks()).toEqual([]);
  });

  it('Keep OFF: the strict pre-v9 purge, with no sheet and no footer line', async () => {
    resetFakeRepos({ keepUnplanned: false });
    seedLeftovers();
    const screen = await renderHome();

    expect(await screen.findByText('Nothing here. Tap + to add.')).toBeTruthy();
    expect(screen.queryByText('Left from last time')).toBeNull();
    expect(screen.queryByText(/left from last time/)).toBeNull();
    expect(getAllFakeTasks()).toEqual([]);
  });
});

describe('limits (spec 3.5 v9)', () => {
  function fillToday(count: number) {
    for (let i = 1; i <= count; i++) tasksRepo.add(WED, `Open ${i}`);
  }

  it('Today has 9 open: "Choose up to 1", and after one selection the other rows are disabled', async () => {
    fillToday(9);
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');

    expect(screen.getByText('Choose up to 1')).toBeTruthy();
    await fireEvent.press(screen.getByText('Call bank'));

    expect(rowStates(screen).map((s) => [s.checked, s.disabled])).toEqual([
      [true, false],
      [false, true],
      [false, true],
    ]);

    await fireEvent.press(screen.getByText('Keep 1'));
    expect(getAllFakeTasks().filter((t) => t.day === WED)).toHaveLength(10);
    expect(getAllFakeTasks().filter((t) => t.day !== WED)).toEqual([]);
  });

  it('Today has 10 open: "Today is full", and only Let them go is enabled', async () => {
    fillToday(10);
    seedLeftovers();
    const screen = await renderHome();
    await screen.findByText('Left from last time');

    expect(screen.getByText('Today is full')).toBeTruthy();
    expect(rowStates(screen).every((s) => s.disabled === true)).toBe(true);

    await fireEvent.press(screen.getByText('Call bank'));
    await fireEvent.press(screen.getByText('Keep'));
    expect(screen.getByText('Left from last time')).toBeTruthy(); // nothing happened
    expect(getAllFakeTasks()).toHaveLength(13);

    await fireEvent.press(screen.getByText('Let them go'));
    expect(screen.queryByText('Left from last time')).toBeNull();
    expect(getAllFakeTasks()).toHaveLength(10); // the leftovers went, Today untouched
  });

  it("catch-up tasks don't count toward the limit: the + button still works with 10 waiting", async () => {
    for (let i = 1; i <= 10; i++) tasksRepo.add(TUE, `Old ${i}`);
    const screen = await renderHome();
    await screen.findByText('Left from last time');
    await fireEvent.press(screen.getByTestId('carry-sheet-backdrop'));

    await fireEvent.press(screen.getByLabelText('Add task'));

    expect(screen.getByPlaceholderText('New task')).toBeTruthy();
    expect(screen.queryByText('Full — finish a task to add more')).toBeNull();
  });
});

describe('both sheets due (spec 3.5 v9)', () => {
  it('the catch-up sheet first; the evening sheet follows once it closes', async () => {
    jest.setSystemTime(new Date(2026, 9, 7, 20, 30)); // Wednesday evening, planning mode
    tasksRepo.add(TUE, 'Missed leftover');
    tasksRepo.add(WED, 'Unfinished today');
    const screen = await renderHome();

    expect(await screen.findByText('Left from last time')).toBeTruthy();
    expect(screen.queryByText('Move unfinished to tomorrow?')).toBeNull();

    await fireEvent.press(screen.getByText('Let them go'));

    expect(await screen.findByText('Move unfinished to tomorrow?')).toBeTruthy();
    expect(screen.queryByText('Left from last time')).toBeNull();
  });
});
