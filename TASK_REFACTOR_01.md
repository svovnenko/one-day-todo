# Task REFACTOR-01: pay down fix-round debt (no behaviour changes)

**Golden rule: the app must behave exactly as it does now (spec v7.1).** This is structure only. If you find a real bug along the way, **don't fix it here**: list it in your final message so the owner can decide.

Baseline first: `npx tsc --noEmit` and `npm test` must pass **before** you start; note the test count. Work in small commits (one per section below), and run `tsc` and the tests after each.

---

## 1. One owner for the completion/Undo flow (high: the source of the Undo bugs)
**Today:** the store owns `pendingBatch`, while `app/index.tsx` owns `hiddenRowIds` and `restoreCounts` (around lines 75–81), plus a garbage-collection effect and key tricks to keep them in sync.

**Target:**
- Move **all** completion row state into the store as one small per-task state machine. Suggested shape:
  - `completion: Record<taskId, 'pending' | 'hidden'>`. `pending` means the row is animating out, or is in the batch but not yet hidden. `hidden` means the animation has finished and the task is still in the batch.
  - `restoreVersion: Record<taskId, number>`: bumped on Undo so a restored row remounts fresh. This replaces `restoreCounts`.
- Store actions: `beginComplete(task)` (as now, sets `pending`), `markHidden(taskId)` (called from the row's animation end; a no-op if the task isn't in the batch any more), `undoPending()` (clears the completion entries for the batch and bumps `restoreVersion`), and commit (removes the entries; the tasks are gone from the data anyway).
- Selectors: `visibleTasks(view)` = the list minus `hidden` tasks. The screen doesn't filter itself.
- Delete `hiddenRowIds`, `restoreCounts` and the GC effect from the screen.
- **New store-level unit tests:**
  - swipe → hidden → timeout → deleted;
  - swipe → Undo before the animation ends → the task is visible and `restoreVersion` is bumped;
  - swipe → hidden → Undo → visible;
  - batch A, B, C → Undo → all visible;
  - rollover during a pending batch → committed and entries cleared;
  - `markHidden` for a task no longer in the batch → no-op.

## 2. Split `app/index.tsx` (494 lines, 30 hooks) into focused hooks
Create `src/hooks/`:
- `useInputSession()`: open/close, the session-id guard for `keyboardDidHide`, add/close handlers, and discard-when-full (from OPT-01, 08 and 10).
- `useAutoScroll(listRef)`: the "scroll to new row" flag and `onContentSizeChange` handling.
- `useCarrySheetReveal()`: the `carryPromptDue` + focus + AppState reveal logic (from TASK_FIXES_03).
- `useFooterLines()`: wraps the pure `footerLines()` with store selectors.

**Target:** `app/index.tsx` is mostly layout, about 200 lines or less. Keep `useCallback` and `memo` stability (OPT-01): typing must still cause **0** `TaskRow` re-renders. Check with a temporary `console.count`, and remove it before committing.

## 3. Comments explain *why*, not ticket history
- Remove or rewrite every reference to `TASK_FIXES_xx`, `TASK_xx` and `OPT-01` in code comments (currently 24). Keep the reasoning, drop the ticket number. Spec references (`spec 3.2`) are fine.
- Remove comments that restate the code.

## 4. Dead code
- Remove `tasksRepo.restore()` (no callers). Also grep for any other exported function or type with zero references (repos, logic, components, theme tokens) and remove it.
- Remove leftover files or components from earlier designs, if any (for example anything named `UndoPill`).

## 5. Repo tidy-up
- Move all task files (`TASK_FIXES_01…08`, `TASK_09…11`, `TASK_OPT_01`, `TASK_REFACTOR_01`) into `docs/tasks/`, and `TODO_APP_SPEC.md` into `docs/`. Keep `README.md` in the root.
- Update `README.md`: a 10-line overview, how to run (`npx expo start`), how to publish (`eas update --branch main --environment production`), and where the spec is.

## 6. Update the spec's project structure
Rewrite section 6 ("Project structure") of the spec to match the real tree after this refactor (hooks, `logic/footer.ts`, `limits.ts`, `batchUndoScheduler.ts`, `taskListDiff.ts`, `completion.ts`, `splash.ts`, `viewLock.ts`, `UndoButton.tsx`, and so on), with one line per file. Also update section 8 ("Development plan"): milestones 1–9 are done; add "fix rounds 01–11 and REFACTOR-01 done", and the next items: Android APK, store build (postponed).

---

## Done when
- `npx tsc --noEmit` passes. `npm test` passes, the test count is ≥ the baseline, and the new store tests are included.
- There are no behaviour changes. Report the before and after line counts of `app/index.tsx` and the store.
- Push. Then publish: `eas update --branch main --message "refactor-01 (no behaviour change)" --environment production`, and remind the owner to open the new update in Expo Go.

## Re-test for the owner (quick smoke test, about 3 minutes)
1. Add 3 tasks with Return → the keyboard stays open; auto-scroll works in a long list.
2. Swipe 1 task → Undo → it's back. Swipe 3 quickly → Undo → all 3 are back. Swipe and wait 2s → gone.
3. Fill a list to 10 → the "Full" footer line appears; + is faded and shakes.
4. Evening: the move sheet opens, selecting works, `Move N` and `Let them go` both work.
5. Empty Today by completing everything → `Done for today.`
