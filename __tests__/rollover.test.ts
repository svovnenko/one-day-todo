import { planRollover } from '@/logic/rollover';

describe('planRollover', () => {
  const settings = { planningTime: '20:00', dayEndTime: '04:00' };

  it('plans day mode with the current logical date at 14:00', () => {
    const plan = planRollover(new Date(2026, 8, 29, 14, 0), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      defaultView: 'today',
    });
  });

  it('plans planning mode with tomorrow as the default view at 20:05', () => {
    const plan = planRollover(new Date(2026, 8, 29, 20, 5), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      defaultView: 'tomorrow',
    });
  });

  it('keeps yesterday as "today" and stays in planning mode just after midnight', () => {
    const plan = planRollover(new Date(2026, 8, 30, 1, 30), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      defaultView: 'tomorrow',
    });
  });

  it('rolls to the new day in day mode right at E (04:00)', () => {
    const plan = planRollover(new Date(2026, 8, 30, 4, 0), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-30',
      tomorrowDay: '2026-10-01',
      defaultView: 'today',
    });
  });
});
