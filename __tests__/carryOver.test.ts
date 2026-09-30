import {
  buildCarryOverCandidates,
  isBlockedFromMoving,
  movableTaskCount,
  shouldShowCarryPrompt,
} from '@/logic/carryOver';
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
    expect(shouldShowCarryPrompt(dayModeNow, settings, '2026-09-29', null, 2, 5)).toBe(false);
  });

  it('is false with no movable unfinished tasks', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', null, 0, 5)).toBe(false);
  });

  it('is false if already shown for today', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', '2026-09-29', 2, 5)).toBe(false);
  });

  it('is false when Tomorrow has no free slots (spec 3.4 v7 -- a dead-end sheet)', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', null, 2, 0)).toBe(false);
  });

  it('is true in planning mode, with a movable task, a free Tomorrow slot, not yet shown today', () => {
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', '2026-09-28', 2, 5)).toBe(true);
    expect(shouldShowCarryPrompt(planningNow, settings, '2026-09-29', null, 1, 1)).toBe(true);
  });
});

describe('isBlockedFromMoving (spec 3.4 v5: max 5 moves)', () => {
  it('is not blocked below the limit', () => {
    expect(isBlockedFromMoving(makeTask({ carryCount: 4 }))).toBe(false);
  });

  it('is blocked at and above the limit', () => {
    expect(isBlockedFromMoving(makeTask({ carryCount: 5 }))).toBe(true);
    expect(isBlockedFromMoving(makeTask({ carryCount: 6 }))).toBe(true);
  });
});

describe('movableTaskCount (spec 3.4 v7)', () => {
  it('counts only tasks below MAX_CARRY_COUNT', () => {
    const tasks = [
      makeTask({ id: 'a', carryCount: 0 }),
      makeTask({ id: 'b', carryCount: 4 }),
      makeTask({ id: 'c', carryCount: 5 }),
    ];
    expect(movableTaskCount(tasks)).toBe(2);
  });

  it('is 0 when every task is blocked', () => {
    expect(movableTaskCount([makeTask({ carryCount: 5 }), makeTask({ carryCount: 7 })])).toBe(0);
  });

  it('is 0 for an empty list', () => {
    expect(movableTaskCount([])).toBe(0);
  });
});

describe('buildCarryOverCandidates', () => {
  it('flags a ×5 task as blocked', () => {
    const [candidate] = buildCarryOverCandidates([makeTask({ id: 'a', carryCount: 5 })], []);
    expect(candidate.blocked).toBe(true);
  });

  it('flags a task whose text already exists in tomorrow as deduplicating', () => {
    const today = [makeTask({ id: 'a', text: 'Call bank' })];
    const tomorrow = [makeTask({ id: 'b', text: 'Call bank', day: '2026-09-30' })];
    const [candidate] = buildCarryOverCandidates(today, tomorrow);
    expect(candidate.deduplicates).toBe(true);
  });

  it('does not flag an ordinary, non-duplicate task', () => {
    const [candidate] = buildCarryOverCandidates([makeTask({ id: 'a' })], []);
    expect(candidate.blocked).toBe(false);
    expect(candidate.deduplicates).toBe(false);
  });
});
