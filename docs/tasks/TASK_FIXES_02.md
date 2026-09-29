# Task: fixes after the second device test

Read `TODO_APP_SPEC.md` first (sections 3.2 and 3.3 are already updated).
Fix the three items below. Then run `npx tsc --noEmit` and `npm test`, commit in one commit, push, and give the owner a short re-test list.

---

## 1. The row slides back before it completes (high)

**Observed:** after a swipe right, the row slides back to its normal position, then gets struck through and disappears.

**Cause:** `handleFullSwipe()` in `src/components/TaskRow.tsx` calls `swipeableRef.current?.close()` right away. That was a safety net added in the last fix.

**Expected:** the row stays at its swiped position (the grey zone and ✓ visible), shows the strike-through briefly, and then fades and collapses. It must never slide back.

**Fix:**
- Remove the immediate `close()`.
- Fade the **whole** row, including the revealed action area. Move the `Animated.View` opacity wrapper outside the `Swipeable`, or fade both, so the grey zone doesn't remain after the text fades.
- Undo re-adds the task as a fresh row, so it must appear normal (closed, opacity 1). Verify this.
- A short swipe below the threshold must still snap back (the library's default).

## 2. Undo pill: 3 seconds + a shrinking line (medium)

**Owner decision:** 3s instead of 4s, with a basic visual timer.

**Fix:**
- `src/store/useAppStore.ts`: `UNDO_WINDOW_MS = 3000`; update the comments that say 4s.
- `src/components/UndoPill.tsx`: add a thin line (2pt tall, white at 50% opacity, rounded) along the bottom inside the pill. It starts at full pill width and shrinks linearly to 0 over `UNDO_WINDOW_MS`. Use `Animated.timing` with `useNativeDriver` (a `scaleX` transform anchored to the left edge).
- The animation restarts when a new task replaces the pending undo, so give the pill a `key` of the pending task id.
- Export `UNDO_WINDOW_MS` (or pass it as a prop) so the store and the pill can't disagree.

## 3. The input bar doesn't close or clear (medium)

**Observed:**
- a) Tap a task (its text appears in the bottom input bar for editing), then swipe that same task to complete it. The input bar still shows its text.
- b) Closing the keyboard leaves the input bar visible. Only a tap on the screen removes it.

**Expected (spec 3.3):**
- a) If the task being edited is completed or deleted, close the input bar **without saving**, clear the draft, and dismiss the keyboard.
- b) Whenever the keyboard hides, close the input bar. A non-empty add draft or a changed edit is saved first, the same as `closeInput()`.

**Fix (in `app/index.tsx`):**
- a) In the completion handler passed to `TaskRow` (`onComplete`), check whether `task.id === editingTaskId`. If so, reset `editingTaskId`, `draft` and `inputVisible` without calling `commitDraft()`, then `Keyboard.dismiss()`.
- b) Subscribe to `Keyboard.addListener('keyboardDidHide', …)` and call `closeInput()` when the input bar is visible.
  - Guard against double commits: `closeInput()` itself calls `Keyboard.dismiss()`, so make the close idempotent, for example with a ref flag or by checking `inputVisible`.
  - Avoid stale closures: read the latest draft through a ref, or re-subscribe when the draft changes.
- Check that Return while adding still keeps the keyboard open and does **not** trigger the close.

---

## Re-test list for the owner

1. Swipe a task right → it stays swiped, is struck through, and fades out; it doesn't slide back first.
2. The Undo pill shows a line shrinking over about 3s; Undo within that time restores the task.
3. Tap a task to edit, then swipe the same task → the input bar disappears.
4. Tap +, type something, then close the keyboard → the input bar disappears and the task is saved.
5. Tap +, type, press Return → the task is added and the keyboard stays open.
