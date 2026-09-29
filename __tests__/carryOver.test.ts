import { buildCarryOverCandidates, isBlockedFromMoving, shouldShowCarryPrompt } from '@/logic/carryOver';
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

describe('isBlockedFromMoving (spec 3.4 v5: max 5 moves)', () => {
  it('is not blocked below the limit', () => {
    expect(isBlockedFromMoving(makeTask({ carryCount: 4 }))).toBe(false);
  });

  it('is blocked at and above the limit', () => {
    expect(isBlockedFromMoving(makeTask({ carryCount: 5 }))).toBe(true);
    expect(isBlockedFromMoving(makeTask({ carryCount: 6 }))).toBe(true);
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

