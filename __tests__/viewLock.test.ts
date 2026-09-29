import { resolveView } from '@/logic/viewLock';

// Spec 3.1 (v3): Tomorrow is locked in day mode -- covers the store guard
// used by both setSelectedView (a manual header tap) and addTask (so a
// task's text is never dropped if the input bar was open on Tomorrow when
// the mode flipped from planning back to day).

describe('resolveView', () => {
  it('redirects a tomorrow request to today while in day mode', () => {
    expect(resolveView('tomorrow', 'day')).toBe('today');
  });

  it('leaves a today request alone in day mode', () => {
    expect(resolveView('today', 'day')).toBe('today');
  });

  it('allows tomorrow in planning mode', () => {
    expect(resolveView('tomorrow', 'planning')).toBe('tomorrow');
  });

  it('leaves a today request alone in planning mode', () => {
    expect(resolveView('today', 'planning')).toBe('today');
  });
});
