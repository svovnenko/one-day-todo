import { defaultChecked, shouldShowCarryPrompt } from '@/logic/carryOver';
import type { Task } from '@/db/tasksRepo';

// Only the pure decision functions are unit tested here; moveTasks touches
// SQLite directly (lazily required, see carryOver.ts) and is exercised on
// device instead, per spec section 7's acceptance scenarios.

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    text: 'Call bank',
    day: '2026-09-29',
    position: 1,
    carryCount: 0,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('shouldShowCarryPrompt', () => {
  const settings = { planningTime: '20:00', dayEndTime: '04:00' };
  const planningNow = new Date(2026, 8, 29, 20, 5);
  const dayModeNow = new Date(2026, 8, 29, 14, 0);

  it('is false outside planning mode', () => {
    expect(shouldShowCarryPrompt(dayModeNow, settings, '2026-09-29', null, 2)).toBe(false);
  });

  it('is false with no unfinished tasks', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', null, 0)).toBe(false);
  });

  it('is false if already shown for today', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', '2026-09-29', 2)).toBe(false);
  });

  it('is true in planning mode, with unfinished tasks, not yet shown today', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', '2026-09-28', 2)).toBe(true);
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', null, 1)).toBe(true);
  });
});

describe('defaultChecked', () => {
  it('is checked when carryCount is below 3', () => {
    expect(defaultChecked(makeTask({ carryCount: 0 }))).toBe(true);
    expect(defaultChecked(makeTask({ carryCount: 2 }))).toBe(true);
  });

  it('is unchecked once carryCount reaches 3', () => {
    expect(defaultChecked(makeTask({ carryCount: 3 }))).toBe(false);
    expect(defaultChecked(makeTask({ carryCount: 5 }))).toBe(false);
  });
});
