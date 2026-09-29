# Task 10: move sheet redesign (spec v7)

Read `TODO_APP_SPEC.md` sections 3.4, 4 (the carry-over sheet row) and 10.

## Owner's feedback (screenshot with Tomorrow full)
1. The round circles look like **radio buttons** (pick one) but act like checkboxes (pick several), which is confusing.
2. When Tomorrow is full, the sheet still pops up. Rows can be tapped but nothing can be done, so it's a dead end.

## 1. Selection without circles (`src/components/CarryOverSheet.tsx`)
- Remove the circle checkboxes completely.
- The **whole row is the tap target** (min height `layout.rowHeight`). Tapping toggles selection.
  - **Selected:** text `colors.text` (black) and a black `✓` (17pt) right-aligned.
  - **Unselected:** text `#8E8E93` (`colors.muted`), no mark.
  - **Unavailable** (`carryCount >= 5`): text `colors.faint`, the note `can't move again` right-aligned (13pt, faint), not tappable.
  - **Slots used up:** when the number selected equals N, the remaining unselected rows use `colors.faint` and aren't tappable until something is deselected.
  - The `×N` counter keeps its current style, inline after the text.
- **Subtitle** (13pt, muted): `Choose up to N` if N is smaller than the number of movable tasks, otherwise `Choose what to move`. Remove `Tomorrow: N free` and `Tomorrow is full` from the sheet.
- **Buttons:**
  - Primary: `Move N`, where N is the number selected. When nothing is selected it reads `Move` and is disabled (grey, as now).
  - Secondary: rename `Skip` to **`Let them go`** (same behaviour: marks the prompt as shown and closes).
- Accessibility: each row gets `accessibilityRole="checkbox"` with `accessibilityState={{ checked, disabled }}`.

## 2. No sheet when Tomorrow is full or nothing is movable (store + `app/index.tsx`)
- `shouldShowCarryPrompt` also requires **`freeSlots(tomorrowCount) > 0`** and **at least 1 movable task** (`carryCount < 5`). Add these parameters and update the tests.
- When it's skipped for these reasons, **don't** set `lastCarryPromptDate`. If a slot frees up later that evening, the next evaluation (app becoming active, crossing P) may show it. It doesn't need to react live to swipes in Tomorrow.
- **Fallback line at the end of the Today list (planning mode):**
  - movable tasks exist and N > 0 → the link `Move unfinished to tomorrow` (as now);
  - movable tasks exist and N = 0 → the text `Tomorrow is full` (same style, grey, **not** tappable);
  - no movable tasks → nothing.
- The fallback updates live when Tomorrow's count changes, because it's derived from store state.

## Done when
- `npx tsc --noEmit` and `npm test` pass. Commit, push.
- Publish: `eas update --branch main --message "v7: move sheet redesign" --environment production`.
- **Tell the owner** that Expo Go needs the **new update opened explicitly** (dashboard → update → Preview QR, or Expo Go → Projects → one-day-todo → Branches → main → the top update), because the previous Preview links are pinned to older versions.

## Re-test for the owner
1. At planning time with room in Tomorrow → the sheet shows plain text rows; tapping one turns it black with ✓; `Move 1` becomes active.
2. With only 2 free slots and 4 tasks → the subtitle reads `Choose up to 2`; after picking 2, the other rows fade and can't be tapped.
3. Fill Tomorrow to 10 → no sheet pops up; the end of Today shows `Tomorrow is full`. Complete one Tomorrow task and wait 2s → the line turns back into `Move unfinished to tomorrow`.
4. `Let them go` closes the sheet, and it doesn't reappear that evening.

---

## 3. Replace the "10 tasks max" popup with a quiet list line (added after the owner's screenshot)
**Owner's feedback:** the popup is a narrow box (the text wraps into 5 lines) that floats over the list and covers the `Move unfinished to tomorrow` link.

**Spec 3.2 (v7):**
- **Remove** the popup/toast and its timer completely (`showListFullMessage` and its component/state).
- While the viewed list is full, render a footer line **at the end of the list**: `Full — finish a task to add more` (17pt, `colors.muted`, same padding as the fallback link). Order in `ListFooterComponent`: first this line, then the carry-over link or the `Tomorrow is full` text.
- **Faded + tapped** → `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)` plus a short horizontal shake of the FAB (`Animated` sequence on `translateX`: 0 → 8 → -8 → 6 → -6 → 0, about 300ms, native driver). It doesn't open the input.
- **Return adds the 10th task** → close the input bar (as now); the footer line appears by itself.
- **A draft saved on keyboard-hide when the list is already full** → discard it (as now) and give the same warning haptic, with no text.
- The footer line must stay visible after auto-scroll (the scroll to the new last row should also reveal the footer).

**Re-test (add to the list):**
5. Fill a list to 10 → `Full — finish a task to add more` appears at the end of the list, above the move link; no popup anywhere.
6. Tap the faded + → a short buzz and a small shake, and nothing opens.

## 4. Footer wording and tappability (owner-approved)
The end of the list holds up to two lines, in this order:
1. `Full — finish a task to add more`: when the **viewed** list is full (Today or Tomorrow, any mode). Not tappable.
2. The carry-over line: only in the **Today** view in **planning mode**, and only when Today has movable tasks:
   - Tomorrow has room → **`Move unfinished to tomorrow ›`**: the only tappable line; the `›` chevron signals that it can be tapped. Same grey, same size, with a small gap before `›`.
   - Tomorrow is full and line 1 is also shown → **`Tomorrow is full too`**.
   - Tomorrow is full and line 1 isn't shown → `Tomorrow is full`.
   - Both text variants are not tappable and have no chevron.

Implement it as one pure helper (for example `footerLines({ view, mode, viewedFull, tomorrowFull, hasMovable })` in `src/logic/`) that returns the lines, with unit tests covering every row of this table:

| Situation | Footer |
|---|---|
| Day mode, Today full | `Full — finish a task to add more` |
| Planning mode, Today view, Today full, Tomorrow has room | `Full — …` + `Move unfinished to tomorrow ›` |
| Planning mode, Today view, both full | `Full — …` + `Tomorrow is full too` |
| Planning mode, Today view, Today not full, Tomorrow full | `Tomorrow is full` |
| Planning mode, Today view, nothing full | `Move unfinished to tomorrow ›` |
| Planning mode, Tomorrow view, Tomorrow full | `Full — …` |
| Nothing movable in Today | no carry-over line |

**Re-test (add to the list):**
7. Evening, both lists full → the end of Today shows `Full — finish a task to add more` and `Tomorrow is full too`.
8. The move link shows `›` at the end; the other lines don't.
