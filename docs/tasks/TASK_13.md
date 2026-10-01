# Task 13: Settings layout and the move sheet list height (after the v8 device test)

Start after TASK_12 is fully committed. Keep `npm run check` green. One commit per section.

## 1. The move sheet list is squeezed to about one row (high, possibly hiding tasks)
**Owner's screenshots (dark theme):**
- 20:20: Today had 3 tasks (`проверить ивентХаб`, `тайм-аут на CFP`, `посуда`). The sheet showed only **part of one row** (`посуда`, cut off at the bottom) between the subtitle and `Move`. The other rows were only reachable by scrolling inside a tiny area.
- 20:19 (the automatic sheet at planning time): only **one** row (`1 ×2`) was visible. The owner can't tell whether the other tasks were missing or just hidden below the fold.

**Cause to verify:** `src/components/CarryOverSheet.tsx` uses `ScrollView style={{ flexGrow: 0 }}` inside a sheet with `maxHeight: '70%'`. The ScrollView's height is probably being resolved incorrectly (a percentage `maxHeight` inside an absolutely positioned overlay, the wrapping text from TASK_12, or the slide-in animation measuring before the content is laid out).

**Expected:**
- The sheet **sizes to its content**: all rows are visible without scrolling when they fit. 10 rows plus the header and buttons fit on an iPhone 8-sized screen (667pt), with wrapped rows taken into account.
- It scrolls only when the content is taller than **85% of the screen height** (computed with `useWindowDimensions()` in points, not a percentage string). While it's scrollable, show the scroll indicator, and a subtle fade at the bottom edge of the list so it's obvious there's more.
- **Correctness check:** the sheet lists **every** unfinished Today task (movable plus ×5) **in list order**. Not only the first one, not only the carried ones. Add an RNTL test with 3 tasks (one with `carryCount 2`) that asserts all 3 rows render, plus a test with 10 tasks.
- Re-check the default: all rows start **unselected** (spec v6). In the 20:19 screenshot, `1 ×2` showed a ✓ with `Move 1` active. Confirm this was the owner's tap and not a default; if it's a bug, fix it.

## 2. The disabled `Move` button in dark mode (low)
In dark mode the disabled `Move` is a light grey pill with black text, which looks almost enabled. Disabled state: background `#2C2C2E` (dark) or `#E5E5EA` (light), text `colors.muted`. Add the tokens to both palettes.

## 3. Settings layout (medium)
From the owner's screenshot of Settings in dark mode:
- a) **The `Daily reminder` switch touches the divider line above it.** Rows need consistent vertical padding (at least `paddingVertical: 10`, `minHeight: 44`), and dividers must sit **between** rows, never overlapping a control. Check every row, including `Planning time` (the compact time picker).
- b) **`Day ends at` overflows:** the 5th option (`04:00`) is cut off at the right edge. Make the five options share the width equally (`flex: 1` each, text centered, no fixed widths). It must fit at 320pt width (iPhone SE, 1st gen) up to Pro Max; if needed, shrink the option font to 15pt. Apply the same to the `Theme` segment.
- Check both themes and the safe areas.
- Note: the rounded bar visible at the very top of Settings is the **native iOS modal card stack**: the main screen showing behind the Settings sheet. It's expected and **not** a bug; don't change it.

## Done when
- `npm run check` passes locally and in CI. Commit, push.
- `eas update --branch main --message "v8.1: sheet height, settings layout" --environment production`. Remind the owner to open the new update in Expo Go.

## Re-test for the owner
1. Evening, 3–4 unfinished tasks → the sheet shows **all** of them at once, with no scrolling; all unselected.
2. 10 unfinished tasks → all visible, or clearly scrollable with a fade at the bottom.
3. Settings → the `Daily reminder` switch has space above and below; all five `Day ends at` options are fully visible; there's no strange bar at the top.
4. Dark mode → the grey `Move` button is clearly disabled until you select a task.
