# Task: remove editing + Undo button size and position (after the fourth device test)

## 1. Remove task editing completely (owner decision, spec 3.2 v4)
Tasks can't be edited. **Tapping a task does nothing.** A typo is fixed by completing the task and re-adding it.
- `src/components/TaskRow.tsx`: remove `onEdit` and the tap handler. The row must not react to a tap (no highlight or feedback), but swipe right still completes.
- `app/index.tsx`: remove the whole edit path: `editingTaskId`, the edit branch in `commitDraft` and `handleSubmit`, `openInputFor(task)` for existing tasks (it becomes open-for-add only), and the "cancel the edit when the edited task is completed" logic from TASK_FIXES_02. Keep the add flow as it is: Return adds and keeps the keyboard open; closing the keyboard saves a non-empty draft and closes the bar.
- Store/repo: remove `editTask` / `updateText` if nothing else uses them (check with grep).
- Afterwards, `grep -rn -i "edit" app src` should find no task-editing code.

## 2. Undo button
In `src/components/UndoButton.tsx` (spec 3.2 / 4, v4):
- **Size:** 56pt → **64pt**. Scale the countdown ring with it: keep the 3pt stroke and recompute the radius and circumference from the new size. Keep the `Undo` text at 15pt semibold.
- **Position:** move it from the bottom-right to the **bottom center**, vertically level with the + FAB (the same bottom offset, above the safe area).
- Everything else stays the same: 3s countdown, appears immediately on swipe, restarts on a new completion.

Run `npx tsc --noEmit` and `npm test`, commit, push.

## Re-test for the owner
1. Tap any task → nothing happens.
2. Tap +, type, press Return → the task is added; close the keyboard → the bar disappears.
3. Swipe a task → a slightly bigger round `Undo` button appears at the bottom center, at the same height as +, and its ring empties over 3s.
