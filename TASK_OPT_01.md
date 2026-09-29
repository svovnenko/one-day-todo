# Task OPT-01: smoother typing + no white flash at launch

A pure optimization: **no visible behaviour changes** except those described below. All existing flows (add, Return keeps the keyboard open, the input closes on keyboard hide, swipe, batch Undo, carry-over sheet) must work exactly as before.

## 1. Typing re-renders the whole task list (medium)
**Problem:** `draft` (`useState`) lives in `HomeScreen` (`app/index.tsx`). Every keystroke re-renders `HomeScreen`, which creates a new inline `renderItem` and new callbacks, and `FlatList` re-renders **every visible `TaskRow`**, each with its own `Swipeable`. On an older iPhone with 15+ tasks this can make typing lag.

**Fix:**
- **Move the draft into the input bar.** `InputBar` owns `draft` internally. It exposes `onAdd(text)` (Return: add, clear, keep focus) and `onClose(text)` (keyboard hidden or tap outside: save a non-empty draft, then close). Move the `keyboardDidHide` handling into `InputBar` (or a small `useAddInput` hook) so `HomeScreen` doesn't re-render per keystroke. Keep the session-id guard from TASK_FIXES_04/05 so a stale `keyboardDidHide` can't close a new session.
- **Memoize the rows:** wrap `TaskRow` in `React.memo`. Pass only stable props: `task` (the same object reference unless its data changed), `onSwipeThreshold` and `onAnimationComplete` via `useCallback`. The callbacks must read live state with `useAppStore.getState()` (see TASK_FIXES_07 item 0 on stale closures), so they can have empty dependency arrays.
- **Stable list props:** make `renderItem` and `keyExtractor` `useCallback`s. Move `contentContainerStyle` into `useMemo` or `StyleSheet`, so FlatList doesn't see new props on unrelated renders.
- **Check `refreshTasks`:** make sure it doesn't replace unchanged task objects with new ones for no reason, or `memo` is useless. If `listByDay` always returns new objects, keep the previous object when `id`, `text`, `position` and `carry_count` are all equal (a small helper in the store).
- **Verify:** add a temporary `console.count('TaskRow render ' + task.id)` (remove it before committing). Typing 5 characters must trigger **0** `TaskRow` renders. Swiping one task must re-render only that row (plus the rows that move up).

## 2. White flash at launch (low)
**Problem:** while `init()` opens SQLite and loads the tasks, `HomeScreen` renders an empty `SafeAreaView` (`if (!isReady)`), which shows as a blank white frame after the splash.

**Fix:**
- In `app/_layout.tsx`, call `SplashScreen.preventAutoHideAsync()` at module level (from `expo-splash-screen`, already installed).
- Call `SplashScreen.hideAsync()` once `isReady` becomes true, for example in an effect in `HomeScreen`, or in the layout by subscribing to `isReady`.
- Add a safety net: hide the splash after 3s even if `init()` throws, so the app can never stay stuck on the splash screen. Wrap `init()` in `try/catch` and log the error.
- Keep the splash background `#FFFFFF`, as in `app.json`, so the transition looks seamless.

## Done when
- `npx tsc --noEmit` and `npm test` pass. Commit, push.
- Then publish to Expo Go: `eas update --branch main --message "OPT-01: smoother typing, no launch flash" --environment production`.

## Re-test for the owner
1. Add 20 tasks, then type quickly in the input bar → no lag; Return still adds and keeps the keyboard open.
2. Close the keyboard with a draft → it's saved and the bar closes (as before).
3. Swipe and Undo (single and batch) → work as before.
4. Fully close Expo Go and reopen the app → the splash goes straight to the list, with no white flash.
