# Task 08: auto-scroll, a 10 open-task limit, a 5-move limit (spec v5)

Do `TASK_OPT_01.md` first if it isn't committed yet (it restructures the input bar and the rows; build on top of it).
Read `TODO_APP_SPEC.md` sections 3.2, 3.3, 3.4 and 10 (already updated to v5).

## 1. Auto-scroll to the newly added task (medium)
**Owner's feedback:** when adding at the end of a long list, the new task disappears below the visible area. They want the list to scroll just enough to show it.

**Fix:**
- New tasks are always appended at the end. After an add, set a `scrollToNewPending` flag.
- In `FlatList.onContentSizeChange`, if the flag is set, call `listRef.current?.scrollToEnd({ animated: true })` and clear the flag.
- Scroll only when the content is taller than the visible area. The visible area must take the **keyboard and input bar** into account: the list sits inside the `KeyboardAvoidingView`, so check that its height shrinks while the keyboard is open.
- Adding in a short list must **not** move anything.
- The bottom padding (`listContent.paddingBottom`) must keep the last row clear of the input bar or FAB after the scroll.

## 2. A limit of 10 open tasks per list (high)
**Constant:** `OPEN_TASK_LIMIT = 10` in one place (for example `src/logic/limits.ts`).

**Rules (spec 3.2):**
- **Open count** for a list = its tasks in the DB, including tasks in the pending Undo batch, because those still occupy slots until the batch commits. So Undo can never exceed 10.
- **Store:** `addTask` refuses when the target list has 10 or more open tasks, and returns `false`. This is also a safety net if the UI misses a case.
- **FAB:** when the viewed list is full, render it at 40% opacity. It stays tappable, but a tap shows a small grey message above the FAB for 2s: `10 tasks max. Finish one first.` Don't open the input.
- **Input bar:** if Return adds the 10th task, close the bar and show the same message. A draft saved on keyboard-hide when the list is full is **discarded**, and the message is shown.
- **Existing data:** lists already over 10 aren't trimmed; adding is simply blocked.
- **Unit tests:** blocked at 10; a pending-batch task still counts; a slot frees after the batch commits.

## 3. The move sheet respects tomorrow's slots and a 5-move limit (high)
**Constant:** `MAX_CARRY_COUNT = 5`, next to `OPEN_TASK_LIMIT`.

**Rules (spec 3.4):**
- **Move limit:** a task with `carryCount >= 5` shows greyed out (`colors.faint`), with a disabled checkbox and a small grey note `can't move again`. It can't be moved. `moveTasks` must also filter these out as a safety net.
- **Free slots:** `free = OPEN_TASK_LIMIT - tomorrowOpenCount`. Show `Tomorrow: N free` under the sheet title (13pt, `colors.muted`).
  - **Default checks:** tasks with `carryCount < 3` are checked in list order until `free` is reached; the rest start unchecked.
  - Once `free` tasks are checked, the other (movable) checkboxes are disabled until one is unchecked.
  - If `free === 0`, disable `Move` and set the note to `Tomorrow is full`.
- A deduplicated move (the same text already exists in Tomorrow) doesn't use a slot.
- **Unit tests:** a ×5 task is never moved; default checks are capped at `free`; `free = 0` → nothing moves.

## Done when
- `npx tsc --noEmit` and `npm test` pass. Commit, push.
- Publish: `eas update --branch main --message "v5: limits + auto-scroll" --environment production`.

## Re-test for the owner
1. Add tasks until the list is longer than the screen → each new task scrolls into view above the keyboard.
2. With 10 open tasks → + is grey; tapping it shows `10 tasks max. Finish one first.` Complete one → + is active again (after the 2s Undo window).
3. Swipe a task in a full list, then tap Undo straight away → the list is back to exactly 10, and + stays grey.
4. At planning time with tomorrow nearly full → the sheet shows `Tomorrow: N free`, and you can't check more than N.
5. A task with ×5 → greyed in the sheet with `can't move again`.
