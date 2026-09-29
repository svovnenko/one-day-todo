# Task: fixes after the third device test

Read `TODO_APP_SPEC.md` first (v4: sections 1, 3.1, 3.2, 3.6 and 4 are updated).
Do the three items below. Then run `npx tsc --noEmit` and `npm test`, commit in one commit, push, and give the owner the re-test list.

---

## 1. The Undo pill becomes a round button with a countdown ring (medium)

**Owner's feedback:** remove "Done" and keep only the text "Undo", make the button round, show it faster after the swipe, keep it for 3s, and replace the line with a circle "like a watch or timer".

**Spec (3.2 / 4):**
- A round 56pt button at the bottom-right (16pt from the edges, above the safe area), mirroring the + FAB. Background `#1C1C1E`, containing only the white text **`Undo`** (15pt, semibold, centred). **No icon.**
- A white 3pt **countdown ring** around the button that empties clockwise from 12 o'clock over `UNDO_WINDOW_MS` (3000). Use `react-native-svg` (`npx expo install react-native-svg`; it's included in Expo Go) with a Reanimated-animated `strokeDashoffset`. Rotate the circle -90° so it starts at the top.
- **Appears immediately** when the swipe passes the threshold. Today it only appears after the row's strike-through and fade (about 500ms), because `onComplete` runs at the end of the animation in `TaskRow.tsx`.
  - Split this into two steps: at the swipe threshold, call a new store action (for example `beginComplete(task)`) that starts the undo window and shows the button.
  - The row keeps playing its own strike-through and fade animation, then is hidden. The list must not re-render it after that.
  - The undo timer counts from the swipe, not from the end of the animation.
- Remove the old line timer. Keep `key={pendingTask.id}` so the ring restarts when a new completion replaces the previous one.
- Rename `UndoPill` to `UndoButton` and update the references.

## 2. A newly added task can't be edited by tapping it (high)

**Owner's report:** "when you add an item, you cannot edit it; on tap nothing changes."

Reproduce all of these in Expo Go and fix whichever fail:
- a) Tap +, type `abc`, press Return (the keyboard stays open), then **tap the new `abc` row** while the keyboard is still open.
- b) The same, but close the keyboard first, then tap `abc`.
- c) Tap an older task to edit it, then tap a different task.

**Expected:** a tap on any task opens the input bar with that task's text, focused and ready to edit. If an add session was open, its draft is saved first.

**Likely suspects:**
- In `app/index.tsx`, the `keyboardDidHide` listener (added in TASK_FIXES_02) plus the `isClosingRef` flag. A tap that briefly hides the keyboard can close the session **after** `openInputFor(task)` set it up. `closeInput` then commits and clears the new edit, or `isClosingRef` stays `true` and blocks later sessions.
- The focus effect only depends on `[inputVisible]`. When the input is already visible, switching from add to edit never refocuses, so the new text may not visibly load.
- The outer `Pressable` around the `FlatList` (`onPress={closeInput}` while the input is visible) may take the tap before the row does.

**Fix suggestions:**
- Give each input session an id (a counter ref). `keyboardDidHide` closes only the session it belongs to.
- Refocus on `[inputVisible, editingTaskId]`.
- Make sure a row tap wins over the outer close handler.
- Add a comment explaining the chosen approach.

## 3. Restrict the day-end and planning time ranges (high: confusing dates)

**Owner's report:** today is 29 Sep; setting "Day ends at" to 17:18 made the header show "Today · 28 Sep" and "Tomorrow · 29 Sep". That's correct for the current logic but meaningless for a user.

**Owner decision (spec 3.1 / 3.6):** the day may switch **only after midnight**.
- **Day ends at:** choose from **00:00 / 01:00 / 02:00 / 03:00 / 04:00** only (default 04:00). Replace the time picker with a simple row of 5 options, or a small picker limited to these values. It should look native and minimal.
- **Planning time:** allowed range **12:00–23:59** (default 20:00). The iOS picker can't hide hours, so if the user picks an out-of-range time, show the alert "Planning time must be between 12:00 and 23:59." and keep the old value. On Android, the same validation applies.
- **On load:** if the stored `dayEndTime` isn't one of the 5 allowed values, or `planningTime` is outside 12:00–23:59, reset it to the default, save it, and reschedule the reminder. This cleans up the owner's test value 17:18.
- Remove the "Planning time is right after day end" hint, which can no longer happen.
- `dates.ts`: add pure validators (`isValidDayEnd`, `isValidPlanningTime`) with unit tests. The offset logic stays unchanged.

---

## Re-test list for the owner
1. Swipe a task → the round Undo button appears instantly at the bottom-right; the ring empties over 3s; tapping it restores the task.
2. Swipe two tasks quickly → the button and ring restart for the second task.
3. Tap +, type `abc`, press Return, tap `abc` → it opens for editing; change it and close the keyboard → it's saved.
4. Settings → "Day ends at" offers only 00:00–04:00; the header dates are correct (Today = the calendar date during the day).
5. Settings → set the planning time to 10:00 → an alert appears and the value doesn't change. Set it to a few minutes ahead (after 12:00) → at that time Tomorrow appears.
