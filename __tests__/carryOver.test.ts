import {
  buildCarryOverCandidates,
  defaultChecked,
  defaultCheckedIds,
  isBlockedFromMoving,
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

describe('defaultCheckedIds (spec 3.4 v5: capped at tomorrow\'s free slots)', () => {
  it('checks eligible tasks in list order up to the free-slot cap', () => {
    const today = [
      makeTask({ id: 'a', position: 1 }),
      makeTask({ id: 'b', position: 2 }),
      makeTask({ id: 'c', position: 3 }),
    ];
    const candidates = buildCarryOverCandidates(today, []);

    const checkedWithTwoFree = defaultCheckedIds(candidates, 2);
    expect(checkedWithTwoFree).toEqual(new Set(['a', 'b']));
  });

  it('a ×5 blocked task is never checked, regardless of free slots', () => {
    const today = [makeTask({ id: 'a', carryCount: 5 })];
    const candidates = buildCarryOverCandidates(today, []);
    expect(defaultCheckedIds(candidates, 10)).toEqual(new Set());
  });

  it('a task with carryCount >= 3 (but < 5) starts unchecked, as before', () => {
    const today = [makeTask({ id: 'a', carryCount: 3 })];
    const candidates = buildCarryOverCandidates(today, []);
    expect(defaultCheckedIds(candidates, 10)).toEqual(new Set());
  });

  it('with free = 0, nothing new gets checked', () => {
    const today = [makeTask({ id: 'a' }), makeTask({ id: 'b', position: 2 })];
    const candidates = buildCarryOverCandidates(today, []);
    expect(defaultCheckedIds(candidates, 0)).toEqual(new Set());
  });

  it('a deduplicating task is checked without counting against the free-slot cap', () => {
    const today = [
      makeTask({ id: 'a', text: 'Dupe' }),
      makeTask({ id: 'b', text: 'New task', position: 2 }),
    ];
    const tomorrow = [makeTask({ id: 'c', text: 'Dupe', day: '2026-09-30' })];
    const candidates = buildCarryOverCandidates(today, tomorrow);

    // Only 1 free slot, but the dedup task doesn't consume it, so both end up checked.
    const checked = defaultCheckedIds(candidates, 1);
    expect(checked).toEqual(new Set(['a', 'b']));
  });
});
