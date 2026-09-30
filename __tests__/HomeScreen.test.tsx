import { act, fireEvent, render } from '@testing-library/react-native';
import { Keyboard, LayoutAnimation } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import HomeScreen from '../app/index';
import { useAppStore } from '@/store/useAppStore';
import { getAllFakeTasks, resetFakeRepos } from './testUtils/fakeRepos';

// Spec section 7's acceptance scenarios, exercised at the screen level
// against the real store/hooks and the in-memory fake repos (see
// jest.setup.ts and src/db/__mocks__/). expo-router itself is mocked --
// none of these scenarios navigate, so a full router context isn't needed.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useIsFocused: () => true,
}));

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

beforeEach(() => {
  resetFakeRepos();
  // Fake timers throughout: TaskRow's own completion animation
  // (STRIKE_DELAY_MS, then a fade, then a collapse) and the store's 2s
  // Undo window both use real setTimeout. Under real timers those keep
  // firing in the background after a test (and its render tree) is
  // already gone, crashing on "trying to import a file after the Jest
  // environment has been torn down." Fake timers make that time not
  // pass at all unless a test explicitly advances it.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

type Screen = Awaited<ReturnType<typeof renderHome>>;

/** Opens the input bar (if not already open) and submits `text` via Return. */
async function addTask(screen: Screen, text: string) {
  const { queryByPlaceholderText, getByLabelText } = screen;
  if (!queryByPlaceholderText('New task')) {
    await fireEvent.press(getByLabelText('Add task'));
  }
  const input = screen.getByPlaceholderText('New task');
  await fireEvent.changeText(input, text);
  await fireEvent(input, 'submitEditing');
}

/**
 * Simulates a completed swipe on the Nth task added this test (fake task
 * ids are assigned in order, starting at 1 -- see
 * src/db/__mocks__/tasksRepo.ts -- and resetFakeRepos() in beforeEach
 * guarantees a fresh count of 1 for every test). Mirrors the task's own
 * suggestion: trigger the swipeable's open handler directly rather than
 * simulating a real drag gesture.
 */
async function swipeComplete(screen: Screen, taskNumber: number) {
  const swipeable = screen.getByTestId(`task-swipeable-mock-task-${taskNumber}`);
  await fireEvent(swipeable, 'swipeableOpen');
}

it('adding 2 tasks with Return: both render, and the input bar stays open', async () => {
  const screen = await renderHome();
  await addTask(screen, 'Buy milk');
  await addTask(screen, 'Walk the dog');

  expect(await screen.findByText('Buy milk')).toBeTruthy();
  expect(await screen.findByText('Walk the dog')).toBeTruthy();
  expect(screen.getByPlaceholderText('New task')).toBeTruthy(); // still open
});

it('completing a task shows Undo; pressing Undo restores it', async () => {
  const screen = await renderHome();
  await addTask(screen, 'Call bank');

  await swipeComplete(screen, 1);

  expect(await screen.findByText('Undo')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Undo'));
  await act(() => jest.advanceTimersByTime(300)); // UndoButton's own exit fade (EXIT_FADE_MS)

  expect(screen.queryByText('Undo')).toBeNull();
  expect(screen.getByText('Call bank')).toBeTruthy();
});

it('regression (spec v8 bug fix): swipe + immediate Undo next to another task never touches LayoutAnimation', async () => {
  // Mixing a global, native-level LayoutAnimation transition with this
  // row's own per-view Animated-driven height collapse -- both fighting
  // over the same view's height in the same commit -- was the root
  // cause of a neighboring row rendering clipped to half its height
  // (owner's screenshot). Asserting LayoutAnimation is never touched at
  // all guards against that pattern coming back, not just this one
  // symptom of it.
  const configureNext = jest.spyOn(LayoutAnimation, 'configureNext');
  const screen = await renderHome();
  await addTask(screen, 'Neighbor task');
  await addTask(screen, 'Task to complete');

  await swipeComplete(screen, 2);
  await fireEvent.press(screen.getByLabelText('Undo'));
  await act(() => jest.advanceTimersByTime(300));

  expect(configureNext).not.toHaveBeenCalled();
  expect(screen.getByText('Neighbor task')).toBeTruthy();
  expect(screen.getByText('Task to complete')).toBeTruthy();
  configureNext.mockRestore();
});

it('completing 3 tasks quickly, then Undo: all 3 are visible', async () => {
  const screen = await renderHome();
  await addTask(screen, 'Task A');
  await addTask(screen, 'Task B');
  await addTask(screen, 'Task C');

  await swipeComplete(screen, 1);
  await swipeComplete(screen, 2);
  await swipeComplete(screen, 3);

  expect(await screen.findByText('3')).toBeTruthy(); // the batch count under "Undo"
  await fireEvent.press(screen.getByLabelText('Undo'));
  await act(() => jest.advanceTimersByTime(300));

  expect(screen.getByText('Task A')).toBeTruthy();
  expect(screen.getByText('Task B')).toBeTruthy();
  expect(screen.getByText('Task C')).toBeTruthy();
});

it('completing a task and letting the 2s Undo window pass: gone from the list and the repo', async () => {
  const screen = await renderHome();
  await addTask(screen, 'Water the plants');
  expect(getAllFakeTasks()).toHaveLength(1);

  await swipeComplete(screen, 1);
  await act(() => jest.advanceTimersByTime(2000)); // the store's UNDO_WINDOW_MS

  expect(screen.queryByText('Water the plants')).toBeNull();
  expect(getAllFakeTasks()).toHaveLength(0);
});

it('filling a list to 10: the "Full" footer shows, and + no longer opens the input', async () => {
  const screen = await renderHome();
  for (let i = 1; i <= 10; i++) {
    await addTask(screen, `Task ${i}`);
  }

  expect(await screen.findByText('Full — finish a task to add more')).toBeTruthy();
  expect(screen.queryByPlaceholderText('New task')).toBeNull(); // the 10th Return closed the bar

  await fireEvent.press(screen.getByLabelText('Add task'));

  expect(screen.queryByPlaceholderText('New task')).toBeNull();
});

it('keyboard hide with a non-empty draft: saved, and the input bar closes', async () => {
  const screen = await renderHome();
  await fireEvent.press(screen.getByLabelText('Add task'));
  await fireEvent.changeText(screen.getByPlaceholderText('New task'), 'Draft task');

  await act(async () => {
    Keyboard.dismiss();
  });

  expect(await screen.findByText('Draft task')).toBeTruthy();
  expect(screen.queryByPlaceholderText('New task')).toBeNull();
});

it('keyboard hide with a non-empty draft on an already-full list: the draft is discarded', async () => {
  const screen = await renderHome();
  await fireEvent.press(screen.getByLabelText('Add task'));
  const input = screen.getByPlaceholderText('New task');

  // Fills the list to 10 through the store directly, not this input bar --
  // e.g. a rollover or a carry-over move landing tasks while the bar
  // happens to be open is the exact race attemptAdd's pre-check guards
  // against (spec 3.2 v7's "safety net").
  await act(async () => {
    for (let i = 1; i <= 10; i++) {
      useAppStore.getState().addTask('today', `Filled ${i}`);
    }
  });

  await fireEvent.changeText(input, 'Should be discarded');
  await act(async () => {
    Keyboard.dismiss();
  });

  expect(screen.queryByText('Should be discarded')).toBeNull();
  expect(screen.queryByPlaceholderText('New task')).toBeNull(); // still closes
});

it('planning mode with Tomorrow full: no carry sheet, and the footer shows "Tomorrow is full"', async () => {
  // Fixed, deterministic instant inside planning mode under the default
  // schedule (P 20:00, E 04:00) -- a Wednesday evening.
  jest.setSystemTime(new Date(2026, 8, 30, 20, 30));
  const screen = await renderHome();

  // Seeded through the store directly: Today needs a movable task (or
  // shouldShowCarryPrompt never gets past "nothing to move" regardless of
  // Tomorrow), and Tomorrow needs to be full. Planning mode is required
  // for 'tomorrow' to not be redirected to 'today' by resolveView.
  await act(async () => {
    useAppStore.getState().addTask('today', 'Leftover from today');
    for (let i = 1; i <= 10; i++) {
      useAppStore.getState().addTask('tomorrow', `Already in tomorrow ${i}`);
    }
    useAppStore.getState().evaluateCarryPrompt();
  });

  expect(screen.queryByText('Move unfinished to tomorrow?')).toBeNull();

  await fireEvent.press(screen.getByText(/^Today/));
  expect(await screen.findByText('Tomorrow is full')).toBeTruthy();
});
