# Task: no gap after completion, bigger/higher Undo, batch undo, 2s window (after the fifth device test)

Read `TODO_APP_SPEC.md` sections 3.2 and 4 (already updated).

## 1. Completing a task leaves an empty gap in the list (high)
**Observed:** after a task is swiped away, an empty space stays where the row was.

**Expected (spec 3.2):** the row strikes through, fades (150ms), then **its height animates to 0 (about 200ms)**, and the rows below slide up smoothly. The list never shows a blank gap, including during the 2s Undo window. Undo re-inserts the row at its original position.

**Investigate first:** find out what occupies the space. Candidates:
- the `Animated.View` at opacity 0 that still keeps its height,
- the `Swipeable` left-action panel still open,
- the `hiddenRowIds` filter in `app/index.tsx` not applying (a stale set, or the GC effect removing the id while the task still exists during `pendingUndo`),
- FlatList keeping a cached item layout.

**Owner's screenshot:** after completing two tasks, **two gaps** (one row-height each) remain in the list. So the gaps stay **permanently**, even after the undo window has committed. Check whether the gap lasts for the Undo window or forever, and whether it disappears on its own after the Undo button is gone.

**Fix suggestion:**
- After the fade, animate the row container's height to 0. Measure the height with `onLayout`, then `Animated.timing` the height with `useNativeDriver: false`, or use Reanimated `Layout`/`exiting` animations.
- Only then call `onAnimationComplete` so the list removes it.
- Also call `LayoutAnimation.configureNext(...)` (or use the Reanimated `itemLayoutAnimation` on the FlatList) when the data changes, so the rows below move smoothly and not in a jump.

## 2. Undo button: 1.5× bigger, moved up (medium)
In `src/components/UndoButton.tsx`:
- **Size:** 64pt → **96pt**. The ring stroke goes 3 → 4pt; recompute the radius and circumference from `SIZE`. The `Undo` text goes 15 → **22pt** semibold.
- **Position:** still horizontally centered, but raised: `bottom = 80` above the bottom safe area, so the **button center is about 130pt from the bottom of the screen**. The owner marked this spot on a screenshot: roughly one button-height above the current position, above the + FAB. Currently it's level with the + FAB. It must not overlap the + FAB or the input bar.
- Nothing else changes: it appears immediately on swipe, has a 2s countdown, and restarts on a new completion.

## 3. Undo after several swipes restores nothing (bug), and a new batch-undo behaviour (high)
**Bug (owner):** swipe two or more tasks, then tap Undo → **nothing comes back**. Even under the old rule, the last task should have returned.
- Likely cause: `hiddenRowIds` in `app/index.tsx` isn't cleared on undo, so a restored task stays filtered out of the list. Or the `pendingUndo` replacement commits the wrong task. Verify, and add a unit test for the store.

**New behaviour: batch undo (owner decision, spec 3.2 v4):**
- Replace `pendingUndo: { task, timeoutId }` with `pendingBatch: { tasks: Task[], timeoutId }`.
- **Each swipe** (`beginComplete`) adds the task to the batch and **restarts** the 2s timer (clear the old timeout, set a new one). It does **not** commit the earlier tasks.
- **Undo** restores **all** tasks in the batch. The rows aren't deleted from SQLite until commit, so they return at their original positions. Clear the batch ids from `hiddenRowIds` as well.
- **Timeout** → delete all batch tasks permanently in one transaction.
- `runRollover` and AppState → `background` commit the batch first.
- Carry-over sheet and fallback link: exclude **all** batch tasks, not just one.
- **UndoButton:** the ring restarts on every new swipe (key it on a batch version counter, not a task id). When `tasks.length >= 2`, show the count as a small line under `Undo` (13pt, white, 70% opacity).
- Unit tests: swipe A, B, C, Undo → all three restored; swipe A, B, then timeout → both deleted; swipe A, wait 1.5s, swipe B → the timer restarts, so A isn't deleted at the 2s mark.

## 4. Undo window 3s → 2s (owner decision)
Set `UNDO_WINDOW_MS = 2000` in `src/store/useAppStore.ts`. The ring and all timers use this constant, so there are no other hard-coded values. Update comments and tests that mention 3s.

---

Run `npx tsc --noEmit` and `npm test`, commit **once for the whole task**, push.

## Re-test for the owner
1. Swipe a middle task → it fades, the rows below slide up, and no empty space is left.
2. Tap Undo → the task comes back in its original place.
3. The Undo button is bigger (1.5×) and sits higher, above the + button.
4. Swipe three tasks quickly → the button shows `Undo` with `3` under it; tap it → all three come back in place.
5. Swipe two tasks and wait → after 2s both are gone for good (they stay gone after restarting the app).
