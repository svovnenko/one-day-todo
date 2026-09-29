# Task: fixes after the first device test (iPhone, Expo Go)

Read `TODO_APP_SPEC.md` first. It has already been updated for these changes (sections 3.1, 3.3 and 4, and test rows 6, 20–22).
Fix the four items below. Then run `npx tsc --noEmit` and `npm test`, commit the fixes in one commit, push, and tell the owner exactly what to re-test on the iPhone.

---

## Bug 1: swipe right doesn't complete the task (high)

**Observed:** swiping a row right reveals the grey zone with the ✓. The row **stays open** and is never deleted. It can be swiped back left even after a long time. No strike-through, no Undo pill.

**Expected (spec 3.2):** a swipe past the threshold completes the task. That means a haptic, a brief strike-through, a collapse with a 150ms fade, and the Undo pill for 4s. A short swipe snaps back closed. A row must never stay open.

**Likely cause:** in `src/components/TaskRow.tsx`, `onSwipeableOpen` only reacts to `SwipeDirection.LEFT`. In `react-native-gesture-handler` ~2.32 `ReanimatedSwipeable`, the direction value reports the **swipe direction**. Swiping right to reveal `renderLeftActions` therefore reports `SwipeDirection.RIGHT`, and `handleFullSwipe()` is never called.
Verify this against the installed package (`node_modules/react-native-gesture-handler/src/components/ReanimatedSwipeable*`); don't just guess.

**Fix:**
- Complete the task whenever the left actions open. Only left actions exist, so any open event means complete; compare against the correct enum value or ignore the direction entirely.
- As a safety net, if the row ever ends up open without completing, close it (`swipeableRef.current?.close()`).
- Keep the rules "tap never completes" and "one pending undo at a time".

## Bug 2: Tomorrow is reachable before planning time (medium)

**Observed:** during the day, before planning time P (default 20:00), the user can tap `Tomorrow` in the header and view or add tasks there.

**Expected (updated spec 3.1 and 4):**
- **Day mode:** only the `Today · …` label is shown. Tomorrow can't be selected, viewed or written to.
- **Planning mode:** both labels are shown, and the user switches freely, as before.

**Fix:**
- `src/components/Header.tsx`: take `mode` (or `showTomorrow`) as a prop, and render the Tomorrow label only in planning mode.
- `src/store/useAppStore.ts`: `setSelectedView('tomorrow')` must be ignored in day mode. Keep `selectedView` consistent with `mode`: when `refreshMode` or `runRollover` switches to day mode, the view must be `today`.
- `app/index.tsx`: make sure `addTask` can't target Tomorrow in day mode, for example if the input bar is open at the moment day mode starts.
- Add unit tests for the store guard if the current setup allows it.

## Change 3: new tasks start with a lowercase letter (low)

**Expected (spec 3.3):** the keyboard starts in lowercase when adding or editing a task.

**Fix:** in `src/components/InputBar.tsx`, add `autoCapitalize="none"` to the `TextInput`. Save the text exactly as typed, with no automatic transformation.

## Change 4: remove the task backup feature entirely (medium)

**Owner decision (spec v3):** deleted and done tasks are permanent. The only way back is the Undo pill (4s). There is no export/import. The git/GitHub code backup stays.

**Remove:**
- `src/logic/backup.ts` and `__tests__/backup.test.ts`
- `app/settings.tsx`: the whole **Backup** section, its handlers (`exportBackup`/`importBackup`, `pickBackupJson`, `validateBackup`) and the related alerts
- `src/store/useAppStore.ts`: the `exportBackup` and `importBackup` actions and their types and imports
- `src/db/tasksRepo.ts`: `replaceAll`, and `src/db/settingsRepo.ts`: `replaceScheduleSettings`, if nothing else uses them (check with grep)
- Dependencies: `npm uninstall expo-file-system expo-sharing expo-document-picker`. First check that nothing else imports them, and check `app.json` plugins.
- Afterwards, `grep -ri "backup\|export\|DocumentPicker\|Sharing" app src __tests__` should find nothing backup-related.
- Keep the Undo pill exactly as it is (4 seconds, one pending undo).

---

## Re-test checklist for the owner (put this in your final message)

1. Swipe a task right firmly → it's struck through and disappears; `Done · Undo` appears; Undo brings it back.
2. Swipe a task a little → it snaps back and stays.
3. Before planning time → the header shows only Today; there's no way to reach Tomorrow.
4. Set the planning time to a few minutes from now in Settings (or earlier than the current time) → the Tomorrow label appears and is selected.
5. Tap + and type `buy milk` → it starts lowercase.
6. Open Settings → only Planning time, Day ends at and Daily reminder remain; there's no Backup section.
