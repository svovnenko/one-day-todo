import {
  addDays,
  dateKey,
  isPlanningMode,
  offset,
  planningRightAfterDayEndHint,
  todayKey,
  tomorrowKey,
} from '@/logic/dates';

// Full suite for spec 7 #19: E/P boundaries, P after midnight, month/year
// rollover, and DST change days.

describe('todayKey / tomorrowKey with E=04:00', () => {
  const E = '04:00';

  it('keeps the previous calendar date as "today" before E', () => {
    const now = new Date(2026, 8, 30, 1, 30); // Wed 30 Sep, 01:30
    expect(todayKey(now, E)).toBe('2026-09-29');
    expect(tomorrowKey(now, E)).toBe('2026-09-30');
  });

  it('rolls to the new calendar date at/after E', () => {
    const now = new Date(2026, 8, 30, 4, 10); // Wed 30 Sep, 04:10
    expect(todayKey(now, E)).toBe('2026-09-30');
    expect(tomorrowKey(now, E)).toBe('2026-10-01');
  });

  it('rolls over a month boundary', () => {
    expect(tomorrowKey(new Date(2026, 8, 30, 10, 0), E)).toBe('2026-10-01');
  });

  it('rolls over a year boundary', () => {
    expect(tomorrowKey(new Date(2026, 11, 31, 10, 0), E)).toBe('2027-01-01');
  });

  it('keeps the previous year as "today" just after New Year\'s midnight (before E)', () => {
    expect(todayKey(new Date(2027, 0, 1, 0, 30), E)).toBe('2026-12-31');
  });
});

describe('isPlanningMode with P=20:00, E=04:00', () => {
  const P = '20:00';
  const E = '04:00';

  it('is day mode at 14:00', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 14, 0), P, E)).toBe(false);
  });

  it('is day mode at 19:59, planning mode at 20:00 (exact P boundary)', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 19, 59), P, E)).toBe(false);
    expect(isPlanningMode(new Date(2026, 8, 29, 20, 0), P, E)).toBe(true);
  });

  it('is planning mode at 20:05', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 20, 5), P, E)).toBe(true);
  });

  it('is still planning mode just after midnight (before E)', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 1, 30), P, E)).toBe(true);
  });

  it('is planning mode at 03:59, day mode at 04:00 (exact E boundary)', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 3, 59), P, E)).toBe(true);
    expect(isPlanningMode(new Date(2026, 8, 30, 4, 0), P, E)).toBe(false);
  });
});

describe('isPlanningMode with P after midnight (P=01:00, E=04:00)', () => {
  const P = '01:00';
  const E = '04:00';

  it('is day mode late evening, before P arrives overnight', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 22, 0), P, E)).toBe(false);
    expect(isPlanningMode(new Date(2026, 8, 30, 0, 30), P, E)).toBe(false);
  });

  it('switches to planning mode right at P (01:00)', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 1, 0), P, E)).toBe(true);
    expect(isPlanningMode(new Date(2026, 8, 30, 3, 59), P, E)).toBe(true);
  });

  it('is day mode again right at E (04:00)', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 4, 0), P, E)).toBe(false);
  });
});

describe('offset()', () => {
  it('wraps correctly across midnight with E=04:00', () => {
    expect(offset(new Date(2026, 8, 30, 3, 59), '04:00')).toBe(1439);
    expect(offset(new Date(2026, 8, 30, 4, 0), '04:00')).toBe(0);
  });
});

describe('DST safety (adding a calendar day never drifts by an hour)', () => {
  // These assertions hold in any timezone, but are only a meaningful DST
  // check in one that observes DST (e.g. run with TZ=America/New_York).
  // The point being tested: addDays/dateKey use local setDate(), not ms
  // arithmetic, so a 23- or 25-hour DST day doesn't shift the wall clock.

  it('spring-forward day (US: 2026-03-08): +1 day keeps the same wall-clock time', () => {
    const beforeJump = new Date(2026, 2, 7, 3, 30); // March 7, 03:30
    const next = addDays(beforeJump, 1);
    expect(next.getHours()).toBe(3);
    expect(next.getMinutes()).toBe(30);
    expect(dateKey(next)).toBe('2026-03-08');
  });

  it('fall-back day (US: 2026-11-01): +1 day keeps the same wall-clock time', () => {
    const beforeFallback = new Date(2026, 9, 31, 3, 30); // Oct 31, 03:30
    const next = addDays(beforeFallback, 1);
    expect(next.getHours()).toBe(3);
    expect(next.getMinutes()).toBe(30);
    expect(dateKey(next)).toBe('2026-11-01');
  });

  it('logical-day math stays correct across the spring-forward night (E=04:00)', () => {
    const E = '04:00';
    // 01:30 on the transition morning is still "yesterday" logically.
    expect(todayKey(new Date(2026, 2, 8, 1, 30), E)).toBe('2026-03-07');
    // Once E has passed, "today" is the transition date itself.
    expect(todayKey(new Date(2026, 2, 8, 4, 30), E)).toBe('2026-03-08');
  });
});

describe('planningRightAfterDayEndHint', () => {
  const E = '04:00';

  it('shows the hint when P is soon after E', () => {
    expect(planningRightAfterDayEndHint('04:15', E)).toBe('Planning time is right after day end');
    expect(planningRightAfterDayEndHint('05:00', E)).toBe('Planning time is right after day end');
  });

  it('is null well away from E', () => {
    expect(planningRightAfterDayEndHint('20:00', E)).toBeNull();
  });

  it('is null when P equals E (that case is blocked elsewhere, not hinted)', () => {
    expect(planningRightAfterDayEndHint('04:00', E)).toBeNull();
  });
});
