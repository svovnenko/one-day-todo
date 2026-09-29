# Task 07: verify and complete everything from the fifth device test

Start this **after** TASK_FIXES_06 is committed. While 06 was in progress, the owner added requirements to it, so the 06 run may have missed some of them.
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
