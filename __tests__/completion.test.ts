import { batchCompletesToday } from '@/logic/completion';

// Only the pure decision function is unit tested here. The "undo doesn't
// set the date" requirement is a property of the store's wiring, not of
// this function: undoPending() cancels the pending batch and never calls
// the scheduler's onCommit at all, so batchCompletesToday is never even
// invoked on an Undo -- there's nothing for it to get wrong. That's
// exercised on device instead, per spec section 7's acceptance scenarios.

describe('batchCompletesToday', () => {
  const todayDay = '2026-09-29';
  const tomorrowDay = '2026-09-30';

  it('is true when the committed batch includes a today task', () => {
    expect(batchCompletesToday([{ day: todayDay }], todayDay)).toBe(true);
  });

  it('is true when only some of the batch is from today', () => {
    expect(batchCompletesToday([{ day: tomorrowDay }, { day: todayDay }], todayDay)).toBe(true);
  });

  it('is false for a tomorrow-only batch', () => {
    expect(batchCompletesToday([{ day: tomorrowDay }], todayDay)).toBe(false);
  });

  it('is false for an empty batch', () => {
    expect(batchCompletesToday([], todayDay)).toBe(false);
  });
});
