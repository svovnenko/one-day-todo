# Task 14: keep unplanned tasks + catch-up sheet (spec v9)

Read `docs/TODO_APP_SPEC.md` sections 1, 3.4, 3.5, 3.6, 5, 7 (rows 25–30) and 10. Keep `npm run check` green. One commit per section.

## Why
Real use showed the weak spot of strict deletion. If the owner doesn't open the app in the evening, everything left is deleted at day end, and the next morning the list is empty. Tasks planned for a day on which the app was never opened are lost the same way.

**Principle: delete by decision, never by accident.**

## 1. Setting (small)
- New settings key `keepUnplanned` (`'1'` / `'0'`). **A missing value means on**, so existing installs get the new behaviour.
- Settings → Schedule: a switch `Keep unplanned tasks`, with the caption "If you skip the evening planning, unfinished tasks wait until you next open the app."
- Change the `Day ends at` caption to "The day switches at this time."
- **Turning it off while catch-up tasks are pending:** show an alert `Delete N kept tasks?` with `Delete` and `Cancel`. `Delete` saves the setting and runs the rollover (which now purges them). `Cancel` leaves the switch on.

## 2. Rollover rule (high; pure logic first)
Today `runRollover` calls `tasksRepo.purgeBefore(todayDay)` unconditionally (`src/store/useAppStore.ts`).

- Add a pure function in `src/logic/rollover.ts`, for example `planPurge({ keepUnplanned, todayDay, lastCarryPromptDate })`, that returns which past days to delete:
  - `keepUnplanned` **off** → delete every task with `day < todayDay` (as now).
  - `keepUnplanned` **on** → delete only tasks with `day < todayDay` **and** `day === lastCarryPromptDate` (the user decided that evening with `Move N` or `Let them go`). Every other task with `day < todayDay` stays as a **pending catch-up task**.
- Repo: add `purgeDay(dayKey)` and `listBefore(dayKey)` (ordered by `day`, then `position`). Keep `purgeBefore` for strict mode.
- Store: new state `catchUpTasks: Task[]`, refreshed in `runRollover` and after every catch-up action. These tasks are **not** in `todayTasks` or `tomorrowTasks` and don't count toward `OPEN_TASK_LIMIT`.
- Note: `lastCarryPromptDate` is only set by `Move N` and `Let them go`. Check that nothing else sets it (a sheet skipped because Tomorrow was full must **not** count as a decision).
- **Unit tests** for `planPurge`: off → all past days; on + decided yesterday → yesterday deleted; on + undecided yesterday → kept; on + decided Monday, tasks planned for Tuesday, opened Thursday → Monday's deleted, Tuesday's kept; `lastCarryPromptDate` null → all kept.

## 3. Catch-up sheet (high)
Reuse `CarryOverSheet` with a `mode: 'evening' | 'catchUp'` prop (or shared row components). Don't fork the styling.

| | Evening (unchanged) | Catch-up |
|---|---|---|
| Title | `Move unfinished to tomorrow?` | `Left from last time` |
| Rows | Today's unfinished tasks | `catchUpTasks`, by day then position |
| Target list / N | Tomorrow; N = 10 − tomorrow's open | **Today**; N = 10 − today's open |
| Subtitle | `Choose up to N` / `Choose what to move` | `Choose up to N` / `Choose what to keep` / `Today is full` (N = 0: rows faint, nothing selectable) |
| Primary button | `Move N` | `Keep N` (`Keep`, disabled, when nothing is selected) |
| Secondary button | `Let them go` | `Let them go` |
| Backdrop tap | as now | **closes only; deletes nothing** |

- **Keep N:** move the selected tasks to `todayDay` (appended, `carry_count + 1`, the same duplicate-text rule as `moveTasks`). Then **delete all remaining catch-up tasks**. Do it in one transaction.
- **Let them go:** delete all catch-up tasks.
- ×5 tasks: faint, `can't move again`, not selectable (they're deleted with the rest when the user answers).
- A catch-up raises `carry_count` by 1 no matter how many days were missed.
- **Reveal:** reuse `useCarrySheetReveal` (only when the main screen is focused and the app is active). If both the catch-up and the evening sheet are due, show the catch-up first; evaluate the evening prompt again after it closes.
- All rows start unselected.

## 4. Footer line (medium)
While `catchUpTasks.length > 0`, the Today view (day or planning mode) shows a tappable last footer line: `N left from last time ›`. It reopens the catch-up sheet. Add it to the pure `footerLines()` helper with tests. The existing lines keep their order above it.

## 5. Tests
- RNTL: undecided leftovers → the sheet appears with all of them unselected; `Keep 1` → 1 in Today with counter +1, the rest gone; `Let them go` → all gone; backdrop → nothing deleted and the footer line is shown; evening `Let them go` then the next day → no catch-up sheet; keep off → strict purge.
- Limit: Today has 9 open → `Choose up to 1`; after one selection the other rows are disabled. Today has 10 → `Today is full`, and only `Let them go` is enabled.

## Done when
- `npm run check` passes locally and in CI. Commit, push.
- `eas update --branch main --message "v9: keep unplanned tasks + catch-up" --environment production`. Remind the owner to open the new update in Expo Go.

## Re-test for the owner
1. Leave 2–3 tasks in Today, **don't open the app in the evening**, and open it the next morning → `Left from last time` lists them, unselected. Pick one, tap `Keep 1` → it's in Today with ×1; the others are gone.
2. Another day: in the evening tap `Let them go`. The next morning → no sheet; the leftovers are gone.
3. Tap outside the catch-up sheet → nothing is deleted; Today shows `N left from last time ›`.
4. Settings → turn `Keep unplanned tasks` off while tasks are waiting → the alert asks before deleting them.

Tip for testing without waiting a night: there's no quick way to move the day end forward (it's limited to 00:00–04:00). Set `Day ends at` to 00:00 and check just after midnight, or test the next morning.
