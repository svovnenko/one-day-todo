import { footerLines } from '@/logic/footer';

describe('footerLines (spec 3.2/3.4 v7)', () => {
  it('day mode, Today full -> just the full line', () => {
    expect(
      footerLines({ view: 'today', mode: 'day', viewedFull: true, tomorrowFull: false, hasMovable: true })
    ).toEqual([{ text: 'Full — finish a task to add more', tappable: false, kind: 'full' }]);
  });

  it('planning mode, Today view, Today full, Tomorrow has room -> full line + move link', () => {
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: true, tomorrowFull: false, hasMovable: true })
    ).toEqual([
      { text: 'Full — finish a task to add more', tappable: false, kind: 'full' },
      { text: 'Move unfinished to tomorrow ›', tappable: true, kind: 'carryOver' },
    ]);
  });

  it('planning mode, Today view, both full -> full line + "Tomorrow is full too"', () => {
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: true, tomorrowFull: true, hasMovable: true })
    ).toEqual([
      { text: 'Full — finish a task to add more', tappable: false, kind: 'full' },
      { text: 'Tomorrow is full too', tappable: false, kind: 'carryOver' },
    ]);
  });

  it('planning mode, Today view, Today not full, Tomorrow full -> just "Tomorrow is full"', () => {
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: false, tomorrowFull: true, hasMovable: true })
    ).toEqual([{ text: 'Tomorrow is full', tappable: false, kind: 'carryOver' }]);
  });

  it('planning mode, Today view, nothing full -> just the move link', () => {
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: false, tomorrowFull: false, hasMovable: true })
    ).toEqual([{ text: 'Move unfinished to tomorrow ›', tappable: true, kind: 'carryOver' }]);
  });

  it('planning mode, Tomorrow view, Tomorrow full -> just the full line (no carry-over line in Tomorrow view)', () => {
    expect(
      footerLines({ view: 'tomorrow', mode: 'planning', viewedFull: true, tomorrowFull: true, hasMovable: true })
    ).toEqual([{ text: 'Full — finish a task to add more', tappable: false, kind: 'full' }]);
  });

  it('nothing movable in Today -> no carry-over line, regardless of other flags', () => {
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: false, tomorrowFull: false, hasMovable: false })
    ).toEqual([]);
    expect(
      footerLines({ view: 'today', mode: 'planning', viewedFull: true, tomorrowFull: true, hasMovable: false })
    ).toEqual([{ text: 'Full — finish a task to add more', tappable: false, kind: 'full' }]);
  });

  it('day mode, nothing full -> no lines at all', () => {
    expect(
      footerLines({ view: 'today', mode: 'day', viewedFull: false, tomorrowFull: false, hasMovable: true })
    ).toEqual([]);
  });
});
