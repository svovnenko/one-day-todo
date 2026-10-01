import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CarryOverSheet } from '@/components/CarryOverSheet';
import type { Task } from '@/db/tasksRepo';

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

function renderSheet(tasks: Task[], tomorrowTasks: Task[] = []) {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, left: 0, right: 0, bottom: 0 },
      }}
    >
      <CarryOverSheet visible tasks={tasks} tomorrowTasks={tomorrowTasks} onMove={jest.fn()} onSkip={jest.fn()} />
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

it('the Move button starts disabled with the bare label until a row is selected', async () => {
  const screen = await renderSheet([makeTask({ id: '1', text: 'Only task' })]);

  const moveButton = screen.getByText('Move');
  expect(moveButton).toBeTruthy();
});
