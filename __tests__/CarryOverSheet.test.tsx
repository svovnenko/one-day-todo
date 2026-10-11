import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CarryOverSheet } from '@/components/CarryOverSheet';
import type { Task } from '@/db/tasksRepo';
import { lightColors } from '@/theme';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'id',
    text: 'task',
    day: '2026-09-30',
    position: 0,
    carryCount: 0,
    createdAt: 0,
    ...overrides,
  };
}

function renderSheet(tasks: Task[], targetTasks: Task[] = []) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <CarryOverSheet visible tasks={tasks} targetTasks={targetTasks} onMove={jest.fn()} onSkip={jest.fn()} />
    </SafeAreaProvider>
  );
}

it('renders all 3 tasks, in list order, none pre-selected (spec v8.1 regression)', async () => {
  const tasks = [
    makeTask({ id: '1', text: 'проверить ивентХаб' }),
    makeTask({ id: '2', text: 'тайм-аут на CFP', carryCount: 2 }),
    makeTask({ id: '3', text: 'посуда' }),
  ];
  const screen = await renderSheet(tasks);

  expect(await screen.findByText('проверить ивентХаб')).toBeTruthy();
  // getByText matches a Text node's FULL concatenated content, including
  // its nested carry-counter Text -- this row's own full text is
  // "тайм-аут на CFP  ×2", so a regex substring match is what actually
  // proves both the base text and its counter rendered.
  expect(screen.getByText(/тайм-аут на CFP/)).toBeTruthy();
  expect(screen.getByText(/×2/)).toBeTruthy();
  expect(screen.getByText('посуда')).toBeTruthy();

  // None pre-selected: no checkmark anywhere, and the Move button reads
  // the bare "Move" (its own regression test below covers the label).
  expect(screen.queryByText('✓')).toBeNull();
  expect(screen.getAllByRole('checkbox').every((row) => row.props.accessibilityState.checked === false)).toBe(true);
});

it('renders all 10 tasks (spec v8.1: the sheet must not silently drop rows)', async () => {
  const tasks = Array.from({ length: 10 }, (_, i) => makeTask({ id: `t${i}`, text: `Task ${i + 1}` }));
  const screen = await renderSheet(tasks);

  for (const task of tasks) {
    expect(await screen.findByText(task.text)).toBeTruthy();
  }
});

it('the Move button starts disabled, with the bare label and a clearly inert style (spec v8.1)', async () => {
  const screen = await renderSheet([makeTask({ id: '1', text: 'Only task' })]);

  const moveLabel = screen.getByText('Move');
  expect(moveLabel).toBeTruthy();
  // Spec v8.1: disabled uses a dedicated `disabledBackground`/`muted`
  // pairing, not a dimmer version of the active color -- regression for
  // dark mode's light-grey-pill-with-black-text looking nearly enabled.
  expect(moveLabel.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: lightColors.muted })])
  );
});

describe('catch-up mode (spec 3.5 v9)', () => {
  const leftovers = [
    makeTask({ id: 'a', text: 'Call bank', day: '2026-10-05', position: 1 }),
    makeTask({ id: 'b', text: 'Water plants', day: '2026-10-05', position: 2 }),
    makeTask({ id: 'c', text: 'Email Sam', day: '2026-10-06', position: 1 }),
  ];

  function openTasks(count: number): Task[] {
    return Array.from({ length: count }, (_, i) => makeTask({ id: `open${i}`, text: `Open ${i}`, day: '2026-10-07' }));
  }

  function renderCatchUp(tasks: Task[], todayTasks: Task[]) {
    const onMove = jest.fn();
    const onSkip = jest.fn();
    const onDismiss = jest.fn();
    const screen = render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 640 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <CarryOverSheet
          mode="catchUp"
          visible
          tasks={tasks}
          targetTasks={todayTasks}
          onMove={onMove}
          onSkip={onSkip}
          onDismiss={onDismiss}
        />
      </SafeAreaProvider>
    );
    return { screen, onMove, onSkip, onDismiss };
  }

  it('uses the catch-up copy, lists every row unselected, and starts with Keep disabled', async () => {
    const { screen } = renderCatchUp(leftovers, openTasks(2));
    const view = await screen;

    expect(view.getByText('Left from last time')).toBeTruthy();
    expect(view.getByText('Choose what to keep')).toBeTruthy();
    expect(view.queryByText('Move unfinished to tomorrow?')).toBeNull();
    expect(view.getByText('Call bank')).toBeTruthy();
    expect(view.getByText('Water plants')).toBeTruthy();
    expect(view.getByText('Email Sam')).toBeTruthy();
    expect(view.getAllByRole('checkbox').every((row) => row.props.accessibilityState.checked === false)).toBe(true);
    expect(view.getByText('Keep')).toBeTruthy();
    expect(view.getByText('Let them go')).toBeTruthy();
  });

  it('Keep N moves exactly the selected rows', async () => {
    const { screen, onMove, onSkip } = renderCatchUp(leftovers, openTasks(2));
    const view = await screen;

    await fireEvent.press(view.getByText('Water plants'));
    await fireEvent.press(view.getByText('Email Sam'));
    await fireEvent.press(view.getByText('Keep 2'));

    expect(onMove).toHaveBeenCalledWith(['b', 'c']);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('Keep stays inert until something is selected', async () => {
    const { screen, onMove } = renderCatchUp(leftovers, openTasks(2));
    const view = await screen;

    await fireEvent.press(view.getByText('Keep'));

    expect(onMove).not.toHaveBeenCalled();
  });

  it('Let them go calls onSkip', async () => {
    const { screen, onSkip, onMove } = renderCatchUp(leftovers, openTasks(2));
    const view = await screen;

    await fireEvent.press(view.getByText('Let them go'));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('a backdrop tap only dismisses -- it never reaches onSkip (nothing is deleted)', async () => {
    const { screen, onDismiss, onSkip } = renderCatchUp(leftovers, openTasks(2));
    const view = await screen;

    await fireEvent.press(view.getByTestId('carry-sheet-backdrop'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it('Today has 9 open: "Choose up to 1", and after one selection the other rows are disabled', async () => {
    const { screen, onMove } = renderCatchUp(leftovers, openTasks(9));
    const view = await screen;

    expect(view.getByText('Choose up to 1')).toBeTruthy();

    await fireEvent.press(view.getByText('Call bank'));
    await fireEvent.press(view.getByText('Water plants')); // no slot left -- ignored
    await fireEvent.press(view.getByText('Keep 1'));

    expect(onMove).toHaveBeenCalledWith(['a']);
    const rows = view.getAllByRole('checkbox');
    expect(rows.map((row) => row.props.accessibilityState.disabled)).toEqual([false, true, true]);
  });

  it('Today has 10 open: "Today is full", nothing is selectable, only Let them go works', async () => {
    const { screen, onMove, onSkip } = renderCatchUp(leftovers, openTasks(10));
    const view = await screen;

    expect(view.getByText('Today is full')).toBeTruthy();
    expect(view.getAllByRole('checkbox').every((row) => row.props.accessibilityState.disabled === true)).toBe(true);

    await fireEvent.press(view.getByText('Call bank'));
    await fireEvent.press(view.getByText('Keep'));
    expect(onMove).not.toHaveBeenCalled();
    expect(view.getAllByRole('checkbox').every((row) => row.props.accessibilityState.checked === false)).toBe(true);

    await fireEvent.press(view.getByText('Let them go'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('a x5 task shows "can\'t move again" and can\'t be selected', async () => {
    const tasks = [makeTask({ id: 'x', text: 'Stuck task', carryCount: 5 }), ...leftovers];
    const { screen } = renderCatchUp(tasks, openTasks(1));
    const view = await screen;

    expect(view.getByText('can’t move again')).toBeTruthy();
    await fireEvent.press(view.getByText(/Stuck task/));
    expect(view.getByText('Keep')).toBeTruthy(); // still nothing selected
  });
});

describe('evening mode keeps its behaviour (spec 3.4)', () => {
  it('the backdrop tap is a Let them go, as before', async () => {
    const onSkip = jest.fn();
    const screen = await render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 320, height: 640 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}
      >
        <CarryOverSheet
          visible
          tasks={[makeTask({ id: '1', text: 'Only task' })]}
          targetTasks={[]}
          onMove={jest.fn()}
          onSkip={onSkip}
        />
      </SafeAreaProvider>
    );

    expect(screen.getByText('Move unfinished to tomorrow?')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('carry-sheet-backdrop'));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
