# Task 09: "Done for today." + evening re-commit (spec v6)

Do `TASK_OPT_01.md` and `TASK_FIXES_08.md` first if they aren't committed yet. This task builds on the v5 carry-over sheet (slots and the ×5 limit).
Read `TODO_APP_SPEC.md` sections 3.4, 4 (the "Done for today" row), 5 (settings keys) and 10.

## 1. "Done for today." (low effort)
**Idea:** the app's only "reward" is an empty list. When the user empties Today by **finishing** tasks, name that moment quietly.

- **New setting key:** `lastCompletedDate` (`YYYY-MM-DD`). When a pending Undo batch **commits** and contains at least one task from **today's** list, set `lastCompletedDate = todayDay`. Undo never sets it, and neither do moves to Tomorrow or day-end deletion.
- **Today view, empty list:** if `lastCompletedDate === todayDay`, show `Done for today.`; otherwise show `Nothing here. Tap + to add.` Same style: centered, grey, 17pt, no animation, icon or haptic.
- **Tomorrow view:** always the normal empty state.
- The line appears only **after** the batch commits (2s after the last swipe), not while Undo is still possible.
- **Unit tests:** a commit of a today task sets the date; undo doesn't; a commit of a tomorrow-only batch doesn't.

## 2. Evening re-commit: everything starts unchecked (low effort)
**Idea (default effect):** moving a task to tomorrow must be a conscious decision, not autopilot.

- `CarryOverSheet`: **all** movable tasks start **unchecked**. Remove the "checked unless ×3" default and the `defaultChecked` logic, and update its tests.
- Everything else from v5 stays: the ×5 tasks are greyed and disabled, `Tomorrow: N free` is shown, at most N can be checked, and `Move` is disabled when N = 0.
- **Also:** `Move` is **disabled while nothing is checked** (there's nothing to move); `Skip` is always enabled.

## Done when
- `npx tsc --noEmit` and `npm test` pass. Commit, push.
- Publish: `eas update --branch main --message "v6: done for today, evening re-commit" --environment production`.

## Re-test for the owner
1. Swipe away every task in Today → after about 2s, `Done for today.` appears.
2. Swipe the last task and tap Undo → the task is back and no message appears.
3. At planning time → the move sheet shows every task **unchecked**, and `Move` is grey until you check one.
