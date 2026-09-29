# Task 07: Undo is broken (critical) + verify everything from the fifth device test

## 0. CRITICAL: Undo doesn't bring tasks back (owner, after the 06 commit e35229a)
**Root cause (found by reading the code):**
1. `TaskRow.handleFullSwipe()` captures `onAnimationComplete` **at swipe time**. That's `handleAnimationComplete` from `app/index.tsx`, rendered **before** `beginComplete` set `pendingBatch`, so its `pendingBatch` is a **stale `null`**.
2. When the animation ends, `if (!pendingBatch?.tasks.some(...)) return;` exits early, so the id is **never added to `hiddenRowIds`**. The row stays mounted, invisible only because its own state has `opacity = 0` and a collapsed `height = 0`.
3. On Undo, `handleUndo` removes the ids from `hiddenRowIds`, but they were never there. The row stays mounted with `isCompleting = true`, opacity 0 and height 0. **The task is back in the data but invisible.** The same happens if Undo is tapped before the ~700ms animation finishes.

**Fix (both parts required):**
- a) **No stale closures:** in `handleAnimationComplete` (and `handleUndo`), read the live store with `useAppStore.getState().pendingBatch`, not the render-time value. Alternatively, let the row call a stable callback (`useCallback` + ref).
- b) **A restored row must look normal again:** pass `isPending` (the task is in the current batch) to `TaskRow`. When `isPending` changes from true to false while the row is completing or collapsed, reset it: `opacity = 1`, stop the animations, drop the fixed height (`isCollapsing = false`), `isCompleting = false`, and close the swipeable. A simpler alternative: key restored rows with a restore counter (`key={task.id + ':' + restoreCount}`) so they remount fresh. Pick one and comment why.
- Add a test (or at least a manual check) for **Undo after the animation has finished** and **Undo during the animation**, for 1 task and for 3 tasks.

Do this item **first**, then the checklist below.

---

TASK_FIXES_06 is committed (e35229a). While 06 was in progress, the owner added requirements to it, so the 06 run may have missed some of them.
Read `TODO_APP_SPEC.md` sections 3.2 and 4, and `TASK_FIXES_06.md` (final version). Then go through this checklist against the **code**, and implement whatever is missing or different:

| # | Requirement | Where |
|---|---|---|
| 1 | No empty gap after a completion: the row fades, its height collapses to 0, and the rows below slide up. The gap was permanent before. | `TaskRow.tsx`, `app/index.tsx` |
| 2 | Undo button is **96pt**, 4pt ring, `Undo` text 22pt semibold | `UndoButton.tsx` |
| 3 | Undo button is centered with `bottom = 80` above the safe area (center about 130pt from the bottom), not level with the + FAB | `UndoButton.tsx` |
| 4 | Bug fixed: Undo after several swipes restores the tasks. Before, nothing came back. | store + `app/index.tsx` |
| 5 | **Batch undo:** each swipe adds to one batch and restarts the timer; Undo restores **all**; timeout deletes all; rollover and app background commit the batch; the carry-over sheet excludes all batch tasks | `useAppStore.ts` |
| 6 | The count under `Undo` when the batch has 2 or more tasks (13pt, white, 70% opacity); the ring restarts on each swipe | `UndoButton.tsx` |
| 7 | **`UNDO_WINDOW_MS = 2000`** (2s, not 3s), used by both the timer and the ring | `useAppStore.ts` |
| 8 | Unit tests: batch undo restores all three; timeout deletes both; a swipe at 1.5s restarts the timer | `__tests__/` |

In your final message, report each row as **already done** or **fixed now**. Run `npx tsc --noEmit` and `npm test`, commit, push. Then give the owner the re-test list from TASK_FIXES_06.
