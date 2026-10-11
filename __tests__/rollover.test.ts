import { planPurge, planRollover, type PurgePlan } from '@/logic/rollover';

describe('planRollover', () => {
  const settings = { planningTime: '20:00', dayEndTime: '04:00' };

  it('plans day mode with the current logical date at 14:00', () => {
    const plan = planRollover(new Date(2026, 8, 29, 14, 0), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      mode: 'day',
      defaultView: 'today',
    });
  });

  it('plans planning mode with tomorrow as the default view at 20:05', () => {
    const plan = planRollover(new Date(2026, 8, 29, 20, 5), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      mode: 'planning',
      defaultView: 'tomorrow',
    });
  });

  it('keeps yesterday as "today" and stays in planning mode just after midnight', () => {
    const plan = planRollover(new Date(2026, 8, 30, 1, 30), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-29',
      tomorrowDay: '2026-09-30',
      mode: 'planning',
      defaultView: 'tomorrow',
    });
  });

  it('rolls to the new day in day mode right at E (04:00)', () => {
    const plan = planRollover(new Date(2026, 8, 30, 4, 0), settings);
    expect(plan).toEqual({
      todayDay: '2026-09-30',
      tomorrowDay: '2026-10-01',
      mode: 'day',
      defaultView: 'today',
    });
  });
});

describe('planPurge (spec 3.5 v9: delete by decision, never by accident)', () => {
  // Which of `days` survive a purge under `plan` -- mirrors what the store does with it.
  function survivors(days: string[], plan: PurgePlan): string[] {
    return days.filter((day) => !(plan.deleteBefore !== null && day < plan.deleteBefore) && day !== plan.deleteDay);
  }

  const MON = '2026-10-05';
  const TUE = '2026-10-06';
  const WED = '2026-10-07';
  const THU = '2026-10-08';

  it('keep OFF: deletes every past day (the strict pre-v9 rule)', () => {
    const plan = planPurge({ keepUnplanned: false, todayDay: THU, lastCarryPromptDate: null });
    expect(survivors([MON, TUE, WED, THU], plan)).toEqual([THU]);
  });

  it('keep OFF ignores lastCarryPromptDate', () => {
    const plan = planPurge({ keepUnplanned: false, todayDay: THU, lastCarryPromptDate: MON });
    expect(survivors([MON, TUE, WED, THU], plan)).toEqual([THU]);
  });

  it('keep ON, the user decided yesterday: yesterday is deleted', () => {
    const plan = planPurge({ keepUnplanned: true, todayDay: WED, lastCarryPromptDate: TUE });
    expect(survivors([TUE, WED], plan)).toEqual([WED]);
  });

  it('keep ON, yesterday undecided: it is kept as pending catch-up', () => {
    const plan = planPurge({ keepUnplanned: true, todayDay: WED, lastCarryPromptDate: MON });
    expect(survivors([TUE, WED], plan)).toEqual([TUE, WED]);
  });

  it('keep ON, decided Monday, tasks planned for Tuesday, opened Thursday: Monday goes, Tuesday stays', () => {
    const plan = planPurge({ keepUnplanned: true, todayDay: THU, lastCarryPromptDate: MON });
    expect(survivors([MON, TUE, THU], plan)).toEqual([TUE, THU]);
  });

  it('keep ON, never decided (lastCarryPromptDate null): nothing is deleted', () => {
    const plan = planPurge({ keepUnplanned: true, todayDay: THU, lastCarryPromptDate: null });
    expect(plan).toEqual({ deleteBefore: null, deleteDay: null });
    expect(survivors([MON, TUE, WED, THU], plan)).toEqual([MON, TUE, WED, THU]);
  });

  it("keep ON, decided today: today's own tasks are never purged by a later rollover the same evening", () => {
    const plan = planPurge({ keepUnplanned: true, todayDay: MON, lastCarryPromptDate: MON });
    expect(plan).toEqual({ deleteBefore: null, deleteDay: null });
  });
});
