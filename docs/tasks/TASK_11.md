# Task 11: footer lines look like one block

## Owner's feedback
With two footer lines (for example `Full — finish a task to add more` and `Tomorrow is full too`), the font sizes differ and the gap between them feels odd.

**Cause (`app/index.tsx`):**
- `fullLineText` uses `type.empty` (17pt), while `fallbackLinkText` uses `type.header` (15pt). The spec said 17pt by mistake; it's now corrected to 15pt.
- Each line is its own `styles.fallbackLink` container with `paddingVertical: 12`, which puts about 24pt of empty space **between** the lines. That's more than the rhythm of the task rows.

## Fix
- **One style for every footer line:** 15pt (`type.header`), `colors.muted`, the same line height. Delete `fullLineText`.
- **One container for the whole footer block:** `paddingHorizontal: layout.screenPadding`, `marginTop: 12` (the gap after the last task row), `gap: 6` between lines.
  - The tappable line (`Move unfinished to tomorrow ›`) is the only one wrapped in a `Pressable`. Give it `hitSlop={{ top: 8, bottom: 8 }}` so the touch area stays comfortable even though the visual padding is small.
  - Its pressed state is opacity 0.5.
- Check with 1 line and with 2 lines: the block should read as one quiet paragraph under the list.

`npx tsc --noEmit`, `npm test`, commit, push, then `eas update --branch main --message "v7.1: footer spacing" --environment production`. Remind the owner to open the new update in Expo Go.

## Re-test for the owner
1. Evening, both lists full → the two grey lines have the same size and sit close together, like one short paragraph.
2. `Move unfinished to tomorrow ›` still opens the sheet when tapped.
