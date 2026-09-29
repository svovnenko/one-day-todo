# Task: the app freezes when planning time arrives (critical)

Do `TASK_FIXES_02.md` first if it isn't committed yet. Then do this task.

## Owner's report
1. In Settings, set the planning time to 16:45 (a few minutes ahead).
2. At 16:45 the "Plan tomorrow" notification arrived.
3. A new page appeared, most likely the carry-over sheet ("Move unfinished to tomorrow?").
4. **The app froze and didn't respond to any touch.**

**Additional facts (owner, second report):**
- After the freeze, Expo Go's dev menu → **Reload** recovers the app. So the native side is alive; the JS state or UI layer is stuck.
- The screenshot of the frozen screen shows the main screen with **Tomorrow selected, Today empty, and no dimmed backdrop**. With Today empty, the carry-over sheet shouldn't be shown at all. Also check for an **invisible** stuck layer: a transparent RN `<Modal>` that was shown and hidden, or the Settings modal mid-dismissal while the P timer fired, `refreshMode()` reset `selectedView`, and a re-render happened during the transition.
- No error text was reported in Metro. Add temporary `console.log` calls in `refreshMode`, `runRollover`, `evaluateCarryPrompt` and the `AppState` listener, then reproduce and read the order of events.

## Suspected causes (verify, don't guess)
The sheet in `src/components/CarryOverSheet.tsx` is a React Native `<Modal>`. It can be shown by several triggers:
- `updateSchedule` → `runRollover` → `evaluateCarryPrompt` fires **while the Settings screen (a native-stack `presentation: 'modal'`) is still open**. That presents an RN `<Modal>` over or under a native modal. On iOS this can leave an invisible modal layer that swallows every touch, especially after Settings is dismissed.
- The `useDayClock` P timer (`refreshMode`) or `AppState` → `active` (after the notification banner or a tap on it) sets `carrySheetVisible` **during an app-state transition**. An RN `<Modal>` presented while the app isn't fully active can get stuck mid-presentation on iOS.
- Also check: whether an infinite re-render or effect loop happens when the sheet opens. In `CarryOverSheet`, the effect depends on `tasks`, and `app/index.tsx` builds a new filtered array on every render. Make sure this can't cycle.

Reproduce each scenario in Expo Go if possible: set P one or two minutes ahead, and stay (a) on the main screen, (b) in Settings, (c) with the app in the background, then tap the notification. Check the Metro logs.

## Required fix
1. **Replace the RN `<Modal>` with an in-screen overlay:** an absolutely positioned `View` (backdrop and bottom sheet) rendered last in `app/index.tsx`, with a simple `Animated` slide-up. There's then no native modal presentation, so it can't get stuck. Keep the look from spec section 4.
2. **Show the sheet only when the main screen is focused and the app is `active`:**
   - `evaluateCarryPrompt` only sets a pending flag (`carryPromptDue`).
   - The main screen shows the sheet using `useFocusEffect` from expo-router, and only when `AppState.currentState === 'active'`.
   - Result: changing P in Settings shows the sheet only **after** the user returns from Settings.
3. **Stabilise the props:** memoize `todayUnfinishedTasks` (`useMemo`), and initialise the checkboxes only when the sheet changes from hidden to visible, not on every `tasks` change.
4. **Add a guard:** Skip, the backdrop tap and Move must always hide the sheet, even if the store update throws. Wrap it in `try/finally`.

## Also: the header gear shows as a coloured emoji (low)
The `⚙` character renders as a colourful iOS emoji. Spec 4 wants a small grey icon. Use `Ionicons` `settings-outline` from `@expo/vector-icons` (included in Expo Go), 20pt, `colors.muted`, with a 44×44 hit area.

## Done when
- Each scenario (main screen / in Settings / backgrounded + notification tap) shows the sheet correctly, and Move and Skip respond.
- Setting P to a time earlier than now while in Settings → nothing freezes. The sheet appears after closing Settings.
- `npx tsc --noEmit` and `npm test` pass. Commit, push, and give the owner the re-test steps below.

## Re-test list for the owner
1. Stay on the main screen, set P two minutes ahead (Settings → back), and wait → the sheet appears, and Move works.
2. Set P two minutes ahead and **stay in Settings** until it passes → close Settings → the sheet appears and responds.
3. Set P two minutes ahead, go to the home screen, and tap the notification when it arrives → the app opens, the sheet responds.
4. Each time, check that nothing freezes.

Note: the sheet shows only once per day (after Move or Skip). Between tests it won't appear again that day. The agent should explain how to reset it (for example a temporary dev-only option or a reinstall), or the owner can test once per day.
