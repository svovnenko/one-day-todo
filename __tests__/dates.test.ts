import { isPlanningMode, offset, todayKey, tomorrowKey } from '@/logic/dates';

// Smoke tests for the milestone-2 data layer's date needs. The full suite
// (E/P boundaries, DST, month/year rollover — spec 7 #19) lands in milestone 5.

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
});

describe('isPlanningMode with P=20:00, E=04:00', () => {
  const P = '20:00';
  const E = '04:00';

  it('is day mode at 14:00', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 14, 0), P, E)).toBe(false);
  });

  it('is planning mode at 20:05', () => {
    expect(isPlanningMode(new Date(2026, 8, 29, 20, 5), P, E)).toBe(true);
  });

  it('is still planning mode just after midnight (before E)', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 1, 30), P, E)).toBe(true);
  });

  it('is day mode right at E', () => {
    expect(isPlanningMode(new Date(2026, 8, 30, 4, 0), P, E)).toBe(false);
  });
});

describe('offset()', () => {
  it('wraps correctly across midnight with E=04:00', () => {
    // 03:59 is 1 minute before E -> offset should be 1439 (end of logical day)
    expect(offset(new Date(2026, 8, 30, 3, 59), '04:00')).toBe(1439);
    // 04:00 exactly is the start of the logical day -> offset 0
    expect(offset(new Date(2026, 8, 30, 4, 0), '04:00')).toBe(0);
  });
});
