# Task 12: long text wraps, 60-character limit, dark theme (spec v8)

Read `docs/TODO_APP_SPEC.md` sections 3.2, 3.6, 4 (the "Dark mode" and "Input counter" rows) and 10.
Keep `npm run check` green (typecheck, lint, tests). One commit per section.

## 0. Bug check first: a task row is cut in half (owner's screenshot)
In a full Today list with one long task (`1234567890 марта день семьи и я…`), the row **above** the long task (`а`) was drawn **half-hidden**: only the top part of the letter was visible.

**Investigate:** a stale fixed `height` from the collapse animation on a reused row, a restored row keeping its collapsed height, FlatList cell measurement with `numberOfLines`, or an overlap from `LayoutAnimation`. Reproduce it (complete a task and Undo next to a long task, and add a long task at the end of a full list), fix the root cause, and add a regression test if it can be tested.

## 1. Long text wraps (high)
- `TaskRow` and the `CarryOverSheet` rows: remove `numberOfLines={1}` and the ellipsis. The text wraps onto as many lines as needed.
- Task text: `fontSize: 20`, **`lineHeight: 26`**. Row: `paddingVertical: 6`, and keep `minHeight: layout.rowHeight` (38), so a single-line row looks exactly as it does now. Multi-line tasks have a visibly larger gap between tasks than between their own lines.
- The collapse animation must measure the **real** height of multi-line rows (`onLayout`); verify it with a 2-line and a 3-line task.
- Auto-scroll must reveal the whole new row even when it wraps.

## 2. Maximum 60 characters (medium)
- `sanitizeTaskText`: the cap goes 200 → **60**. Put the constant in `src/logic/limits.ts` as `MAX_TASK_LENGTH = 60`, and update the tests.
- `InputBar`: `maxLength={MAX_TASK_LENGTH}`. When `remaining <= 10`, show the remaining number at the right edge of the bar (13pt, muted, same vertical centre as the text). Hide it otherwise.
- Existing tasks longer than 60 are **not** truncated in the DB. The limit applies to new input only.

## 3. Dark theme (high)
**Settings (spec 3.6):**
- A new section **Appearance** → `Theme`: `System / Light / Dark` (same control style as "Day ends at"). Default **System**. Stored as the settings key `appearance` (`'system' | 'light' | 'dark'`); invalid or missing values fall back to `'system'`. It applies instantly.

**Theme plumbing:**
- `app.json`: `userInterfaceStyle: "automatic"` (root, `ios`, `android`). Configure the splash plugin with `dark: { backgroundColor: "#000000" }`.
- `src/theme.ts`: `lightColors` and `darkColors` with **the same token names**, values from spec section 4. Add tokens for everything currently hard-coded: FAB background and icon, shadow on/off, input bar background, sheet background and backdrop, the Undo button background, text and ring, selected ✓ colour.
- `useTheme()`: resolves `appearance` + `useColorScheme()` → `{ scheme, colors }`. Components build styles with `useMemo(() => makeStyles(colors), [colors])`. **No static `colors` import is left in components** (lint or grep check).
- `StatusBar style="auto"` (or explicit by scheme). `DateTimePicker themeVariant={scheme}`. The error screen is themed.
- **In Expo Go:** verify that `useColorScheme()` really follows the iPhone setting. If Expo Go forces light, document it and make sure the manual `Dark` option still works.

**Checks:**
- No colour literals left in `app/` and `src/components/` (`grep -rn "#[0-9A-Fa-f]\{6\}" app src/components` returns only `theme.ts`).
- Unit test: `resolveScheme('system', 'dark') → 'dark'`, `resolveScheme('light', 'dark') → 'light'`, and so on.
- The RNTL tests still pass; add one that renders the main screen in dark mode and checks the background token.

## Done when
- `npm run check` passes locally and in CI. Commit, push.
- `eas update --branch main --message "v8: wrap, 60 chars, dark theme" --environment production`. Remind the owner to open the new update in Expo Go.

## Re-test for the owner
1. Add `call bank about the card fee before 16:00 and ask about limits` → typing stops at 60; the counter appears for the last 10 characters; the task wraps onto 2 lines, and the gap to the next task is clearly bigger than the gap between its lines.
2. Complete and Undo a task next to a long one → no row is cut in half.
3. Settings → Theme → Dark → black background, white text; the Undo button is light; the move sheet is dark grey.
4. Theme → System, then switch the iPhone to dark mode (Control Centre → Dark Mode) → the app follows.
