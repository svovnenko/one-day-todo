# One-Day To-Do — Product & Technical Spec

> Handoff document for the development session. Everything here was agreed with the owner on 2026-09-29 (v7: move sheet redesign).
> Build exactly this; anything not listed is out of scope. When in doubt, choose the simpler option.

---

## 1. Product summary

A minimal "paper notepad" to-do app for iPhone. It holds **one day at a time**:

- You write a plain list of tasks for **today** (and, from the evening onward, for **tomorrow**).
- **Swipe right** on a task to complete it. It is struck through and removed, and a round **Undo** button with a countdown ring appears for 2 seconds. After that it is permanently deleted, with no history ("done and forget").
- At a configurable **planning time** (default **20:00**) the app switches to **Tomorrow** so you can plan the next day, and offers to **move unfinished tasks** there. Tasks that keep getting moved show a small **carry-over counter** (×2, ×3…).
- At a configurable **day-end time** (default **04:00**, not midnight, so a late night still counts as today), whatever is left of today is **permanently deleted**. Tomorrow becomes Today.
- No details, no priorities, no due times, no recurring tasks, no timers, no history, no stats, no accounts.

The target user is the owner only (single user, a personal app).

---

## 2. Architecture decisions (locked)

| Area | Decision | Reason |
|---|---|---|
| Runtime | **Expo Go** on iPhone during development | No Apple account or Mac needed |
| Future distribution | Same code, built with **EAS Build** for the App Store and Google Play (postponed by the owner) | Only Expo-Go-compatible libraries are allowed (see rule below) |
| Platforms | iPhone now, **Android-ready** | Don't use iOS-only APIs |
| Dev machine | Windows PC + iPhone (scan the QR code) | No iOS simulator |
| Language | **TypeScript** (strict) | No runtime cost, catches bugs |
| Framework | Latest stable **Expo SDK** (`npx create-expo-app@latest`) | |
| Navigation | **Expo Router** (1 screen + 1 modal) | |
| State | **Zustand** | Selective re-renders, tiny |
| Persistence | **expo-sqlite** (local only) | Fast, reliable, supports queries |
| List | React Native `FlatList` | The list is small (<100 items) |
| Gestures | `react-native-gesture-handler` `ReanimatedSwipeable` + `react-native-reanimated` | Swipe-to-complete; both are included in Expo Go |
| Notifications | **expo-notifications**, local only | Daily "plan tomorrow" reminder |
| Time picker | `@react-native-community/datetimepicker` | Included in Expo Go |
| Haptics | `expo-haptics` | Light tap on complete |
| Backend / cloud | **None** | |
| UI language | **English only** | No i18n library |
| Theme | **Light only** (force white, even in iOS dark mode) | Matches the reference design |

**Hard rule:** install packages only with `npx expo install <pkg>`, and only packages that run in Expo Go. **Do not** use MMKV, Realm, or any library that needs a custom dev client.

**Known limitations (accepted by the owner):**
- Data lives inside Expo Go's sandbox, so deleting Expo Go deletes the tasks. A future store build starts empty. **No task backup**: completed and expired tasks are permanent by design (owner decision, v3).
- A new Expo Go release may need the project to be upgraded (`npx expo install expo@latest && npx expo install --fix`) before it opens again.

### 2.1 Backup of the app itself (code)
- Put the project in **git** from the first commit and push it to a **private GitHub repository**. That is the backup of the app itself.
- Commit after every milestone in section 8.

---

## 3. Functional requirements

### 3.1 Logical day, modes, times
- **Day-end time** `E` (default `04:00`) and **planning time** `P` (default `20:00`) are user settings.
- **Logical date** of a moment `now`: if the local time of `now` is before `E`, it is the previous calendar date; otherwise it is the calendar date.
  - `today` = logicalDate(now); `tomorrow` = today + 1 calendar day.
  - Example with E=04:00: Tue 01:30 → logical date **Mon** (still "today" = Monday).
  - Compute it with local `Date` methods (`setDate(d.getDate() - 1)`), not by subtracting milliseconds, so daylight-saving changes are safe.
- **Minutes into the logical day:** `offset(t) = (minutesOfDay(t) - minutesOf(E) + 1440) % 1440`.
- **Day mode** when `offset(now) < offset(P)`: the default view is **Today**.
- **Planning mode** when `offset(now) >= offset(P)`, i.e. from P until E, across midnight: the default view is **Tomorrow**. Today is still reachable through the header toggle.
- **Allowed ranges (v4, after the device test):** `E` is **00:00–04:00** only, in whole hours: 00:00, 01:00, 02:00, 03:00 or 04:00. So the day never switches before midnight. `P` is **12:00–23:59** only, so planning always happens in the afternoon or evening of the same calendar day. Stored values outside these ranges (for example from testing) are reset to the defaults on load.
- **Tomorrow is locked in day mode** (changed after the first device test). Before P, only **Today** exists for the user: the header shows only the `Today · …` label, and nothing (tap, store action, add) can select or write to Tomorrow.
- In **planning mode** both labels are shown, and the user can switch between Today and Tomorrow freely. When the app becomes active or crosses P or E, the view resets to the mode default.

### 3.2 Tasks
- A task is **text only** (single line, trimmed, 1–200 chars; empty input is ignored).
- New tasks are **appended to the bottom** of the currently viewed list (Today or Tomorrow).
- **Open-task limit (v5):** each list (Today, Tomorrow) holds at most **10 open tasks**. Tasks in the pending Undo batch still count until the batch commits, so Undo can never push a list over 10. When a list is full:
  - the + FAB is greyed out (40% opacity);
  - **no popup or toast of any kind (v7)**. Instead, a grey line `Full — finish a task to add more` (15pt, `#8E8E93`, same style as the other footer lines) is shown **as the first footer line at the end of the list**, above the `Move unfinished to tomorrow` link or `Tomorrow is full` text when those are present. Because it's part of the list, it scrolls with it and never overlaps anything;
  - tapping the faded + gives a **warning haptic** (`Haptics.notificationAsync(Warning)`) and a short horizontal **shake** of the button (about 300ms), and does nothing else;
  - if the input bar is open when the 10th task is added, the bar closes; the footer line appears.
  - Lists that are already over 10 (older data) are left alone; you just can't add until they drop below 10.
- **Swipe right** on a task → it completes:
  - A light haptic fires; the row **stays at its swiped position** (it must not slide back), shows strike-through and grey briefly, then fades (150ms) and **its height collapses to 0 (about 200ms)**, so the rows below slide up. No empty gap is ever left in the list, including during the Undo window. Undo re-inserts the row at its original position.
  - A round **Undo button** appears **immediately** when the swipe passes the threshold, while the row is still animating out. It is 96pt, dark `#1C1C1E`, shows only the white text **`Undo`** (22pt, semibold) with no icon, and sits at the bottom center, **raised: its bottom edge 80pt above the bottom safe area** (the button center is about 130pt from the bottom, above the + FAB).
  - A white **countdown ring** (4pt stroke) around the button empties clockwise from 12 o'clock over **2 seconds**, like a timer. Tapping the button restores the task to its original position.
  - **Batch undo (v4, owner decision):** every swipe adds the task to one pending **batch** and restarts the 2-second countdown. When the batch has 2 or more tasks, a small count (13pt, white, 70% opacity) shows under `Undo`.
  - Tapping **Undo** restores **all** tasks in the batch to their original positions.
  - When 2 seconds pass with no new swipe, **all** tasks in the batch are **deleted permanently**. Rollover, and leaving the app (AppState → background), also commit the batch.
- **No editing (v4, owner decision):** tapping a task does **nothing**. A typo is fixed by completing the task and adding it again.
- A tap never completes a task, which prevents accidental deletions.
- No reordering, no due dates, no notes.

### 3.3 Adding (input)
- A **floating round button** sits at the bottom-left: a white circle with a soft shadow and a **"+"** icon (replaces the ↓ button in the reference screenshot).
- Tapping it opens a **text input bar docked above the keyboard** (placeholder: `New task`).
- The keyboard starts in **lowercase** (`autoCapitalize="none"`) when adding. The text is saved exactly as typed.
- **Return** adds the task, clears the field, and **keeps the keyboard open** for fast entry of several lines.
- **Auto-scroll (v5):** after a task is added, if its row isn't fully visible above the input bar or keyboard, the list scrolls (animated) just enough to show it. If the list fits on screen, nothing moves.
- The input bar closes whenever the keyboard hides (tap outside, keyboard dismiss, swipe down, leaving the screen). Any non-empty text is saved first.

### 3.4 Carry-over (moving unfinished tasks) + counter
- When the app is active **in planning mode**, today has **≥1 movable unfinished task** (carry_count < 5), **Tomorrow has ≥1 free slot** (v7), and the prompt hasn't been shown yet for this logical day, show a **bottom sheet**:
  - Title: `Move unfinished to tomorrow?`
  - A list of today's unfinished tasks with their counters. **No checkboxes or circles (v7):** tap a row to select it. A selected row has **black** text and a black `✓` on the right; an unselected row has **grey** `#8E8E93` text.
  - **Evening re-commit (v6, default effect):** **every task starts unchecked.** Moving a task is always a conscious choice. The earlier "unchecked from ×3" nudge is no longer needed.
  - **Move limit (v5):** a task with `carry_count >= 5` **can't be moved again**. It shows in faint `#B3B3B3` text with the note `can't move again` on the right and can't be tapped. It stays in Today and is deleted at day end if not done.
  - **Tomorrow's slots (v5/v7):** N = 10 minus tomorrow's open tasks. The subtitle reads `Choose up to N` when N is smaller than the number of movable tasks; otherwise it reads `Choose what to move`. Once N rows are selected, the other unselected rows turn faint and can't be tapped until one is deselected. When N = 0, the sheet isn't shown at all (see the fallback link).
  - Buttons: `Move N` (primary; the label includes the number selected, and it's disabled with the label `Move` when nothing is selected) and **`Let them go`** (v7, formerly `Skip`)
- **Move** transfers the checked tasks: they are deleted from Today and appended to Tomorrow with **`carry_count + 1`**.
  - If a task with the exact same text already exists in Tomorrow, don't duplicate it. Set that existing task's `carry_count = max(existing, moved + 1)`.
- **Move** and **Let them go** both mark the prompt as shown (`lastCarryPromptDate = today`).
- A fallback: in planning mode, the **Today** view shows a small grey text link at the list end, `Move unfinished to tomorrow ›` (the chevron marks it as the only tappable footer line). It reopens the sheet.
  - **When Tomorrow is full (v7):** the same spot shows `Tomorrow is full` in grey, or `Tomorrow is full too` when the `Full — finish a task to add more` line is shown above it. It isn't tappable and has no chevron. Once a slot frees up (a task is completed in Tomorrow), it turns back into the link.
  - If Today has no movable tasks (all ×5, or none left), no link is shown.
- **Counter display:** when `carry_count >= 1`, show `×N` after the task text in grey `#B3B3B3`, 13pt, with 6pt spacing. For example `Call bank ×2` means the task was moved twice.
- **Owner's rule:** if the user never opens the app between P and E, unfinished tasks are **deleted at day end without a prompt**. There is no morning catch-up; this was explicitly rejected.

### 3.5 Day-end rollover
- The rule: **delete every task whose `day` < today** (logical date).
- The "Tomorrow" list needs no move; its `day` value simply becomes today.
- Run the rollover:
  1. on app launch (before the first render of the list),
  2. on every `AppState` change to `active`,
  3. through an in-app `setTimeout` to the next **E** while the app is in the foreground (re-armed after it fires).
- The same triggers (plus a timer to the next **P**) detect the planning-mode switch.
- If a completion's undo window is pending during a rollover, commit it first.

### 3.6 Settings (modal)
A **small grey gear icon** in the top-right corner opens a simple grouped list:
- **Schedule**
  - `Planning time`: a time picker limited to **12:00–23:59** (default **20:00**)
  - `Day ends at`: a choice of **00:00 / 01:00 / 02:00 / 03:00 / 04:00** (default **04:00**), with the caption: "Tasks left after this time are deleted."
  - `Daily reminder`: an on/off switch (default **on**)

Changing any time setting reschedules the notification immediately and recomputes the mode.

### 3.7 Reminder notification
- A local notification **repeating daily** at P: title `Plan tomorrow`, body `Write tomorrow's list.`
- Ask for notification permission on first launch. If permission is denied, the app works normally with no reminder.
- Use a daily trigger (`{ type: SchedulableTriggerInputTypes.DAILY, hour, minute }`). Cancel all scheduled notifications and reschedule whenever the settings change.
- Tapping the notification opens the app in planning mode, so the carry-over sheet appears when it applies.


---

## 4. UI / design spec

The reference is the owner's screenshot of the "To Do List" app: a plain white page with black text lines.

| Element | Spec |
|---|---|
| Background | `#FFFFFF` everywhere, light status bar content (dark text) |
| Task text | System font, **20pt**, regular weight, color `#000000` |
| Completing text | Color `#B3B3B3`, `textDecorationLine: 'line-through'` (briefly, before collapse) |
| Carry counter | `×N`, 13pt, `#B3B3B3`, inline after the text |
| Row | Height ≈ **38pt**, left/right padding **16pt**, **no separators, no checkboxes, no icons** |
| Swipe | Swipe right reveals a plain light-grey `#F2F2F7` background behind the row with a thin grey checkmark; a full swipe completes. No colored action buttons. |
| List top | ~24pt gap below the header |
| Header | One line, 15pt, grey `#8E8E93`: `Today · Tue 29 Sep` and `Tomorrow · Wed 30 Sep` as two tappable labels (logical dates). The Tomorrow label is shown **only in planning mode**. The selected label is black and medium weight. The gear icon (18pt, grey) sits on the right. Follow safe areas. |
| FAB | 56pt white circle, bottom-left (16pt from edges, above the safe area), shadow (opacity 0.15, radius 8, offset y 2), black "+" 24pt |
| Undo button | Round, 96pt, bottom center, bottom edge 80pt above the bottom safe area (center about 130pt up), `#1C1C1E`, white text `Undo` 22pt semibold, centred, no icon. A white 4pt countdown ring empties over 2s (`react-native-svg` + Reanimated). It appears immediately on swipe and fades out when the time is up. |
| Input bar | Docked above the keyboard, white, 1px top border `#E5E5EA`, 17pt text, 16pt padding |
| Empty state | Centered grey 17pt: `Nothing here. Tap + to add.` |
| "Done for today" (v6) | In the **Today** view, when the list is empty **and at least one task was completed today** (a batch committed on this logical day), show a centered grey 17pt `Done for today.` instead of the empty state. There is no animation, icon or sound. The Tomorrow view always uses the normal empty state. |
| Carry-over sheet | White bottom sheet with a rounded top (16pt). A plain text list: selected rows are black with a `✓` on the right, unselected rows grey, unavailable rows faint; **no checkboxes or circles**. A full-width black `Move N` button and a grey text `Let them go` button. |
| Dark mode | **Off**: set `"userInterfaceStyle": "light"` in `app.json` |

Date format: `Tue 29 Sep`. Use `Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })`.

---

## 5. Data model (SQLite)

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id           TEXT PRIMARY KEY,         -- random id (expo-crypto randomUUID)
  text         TEXT NOT NULL,
  day          TEXT NOT NULL,            -- 'YYYY-MM-DD' LOGICAL date the task belongs to
  position     INTEGER NOT NULL,         -- ordering within the day (append = max+1)
  carry_count  INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL          -- epoch ms
);
CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day, position);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: planningTime ('20:00'), dayEndTime ('04:00'), reminderEnabled ('1'), lastCarryPromptDate ('YYYY-MM-DD'), lastCompletedDate ('YYYY-MM-DD', v6)
```

- There is no `done` column. Completion is pending in memory during the 2-second undo window, then the row is deleted. If the app is killed during the window, the task survives, which is the safe failure.
- Date keys are built manually from `getFullYear/getMonth/getDate`. **Never** use `toISOString()`, which returns UTC.
- Use `PRAGMA user_version` for migrations (v1 = the schema above).

---

## 6. Project structure

```
app/
  _layout.tsx          # Stack + GestureHandlerRootView; runs init (db, rollover, notifications) before rendering
  index.tsx            # Main list screen (header, list, FAB, input bar, undo pill, carry-over sheet)
  settings.tsx         # Modal: schedule
src/
  db/
    database.ts        # open db, migrations
    tasksRepo.ts       # listByDay, add, updateText, remove, restore, moveToDay, purgeBefore, replaceAll
    settingsRepo.ts    # get/set settings
  store/
    useAppStore.ts     # Zustand: tasks by day, selectedView, mode, settings, pendingUndo, actions
  logic/
    dates.ts           # logicalDate(now,E), tomorrowOf(), offset(), isPlanningMode(now,P,E), msUntilNext(now,'HH:mm'), formatHeader()
    rollover.ts        # runRollover(): commit pending undo, purgeBefore(today), recompute mode
    carryOver.ts       # shouldShowCarryPrompt(), defaultChecked(task), moveTasks(ids)
    notifications.ts   # requestPermission(), scheduleDailyReminder(P), cancelAll()
  hooks/
    useDayClock.ts     # AppState listener + timers to next E and next P → rollover / mode refresh
  components/
    Header.tsx
    TaskRow.tsx        # swipe right → complete; tap does nothing; shows ×N
    UndoPill.tsx
    AddFab.tsx
    InputBar.tsx
    CarryOverSheet.tsx
__tests__/             # jest-expo unit tests for src/logic/*
```

**Rule:** keep all date and time logic in `src/logic/dates.ts` as pure functions that take `now: Date` and the settings, so it can be unit tested.

---

## 7. Acceptance criteria / test scenarios

| # | Scenario | Expected |
|---|---|---|
| 1 | Add 3 tasks with Return between them | All 3 appear in order; the keyboard stays open |
| 2 | Swipe right on a task | It is struck through and removed; the round Undo button appears immediately with a 2s countdown ring; the task is still gone after an app restart |
| 3 | Swipe right, then tap Undo | The task returns to its original position |
| 4 | Complete tasks A, B and C within 2s of each other, then tap Undo | All three come back in their original positions; the button showed the count 3 |
| 5 | Tap a task | Nothing happens (no editing) |
| 6 | Open the app at 14:00 | Today is selected; there is **no Tomorrow label** and no way to reach Tomorrow |
| 7 | Open the app at 20:05 with 2 unfinished tasks today | Tomorrow is selected; the carry-over sheet lists 2 **unchecked** tasks |
| 8 | Move a task that has `carry_count` 0 | It appears in Tomorrow as `Task ×1` |
| 9 | A task with ×5 appears in the carry-over sheet | It is greyed out with `can't move again` and can't be checked |
| 10 | Tap Let them go, then reopen the app | The sheet does not reappear; the fallback link is visible in the Today view |
| 11 | Open the app at 01:30 (E=04:00) | Still the same logical day: the header shows yesterday's calendar date as "Today"; the lists are unchanged; planning mode |
| 12 | Open the app at 04:10 | The old today's tasks are gone; the former Tomorrow is now Today; day mode |
| 13 | Keep the app open across 04:00 | The list rolls over without a restart |
| 14 | Change P to 21:30 and E to 03:00 | The notification is rescheduled; the mode and rollover use the new times |
| 17 | Deny notification permission | The app works; no crash |
| 18 | iOS dark mode is on | The app is still white |
| 19 | Unit tests for `dates.ts` | Cover E/P boundaries (03:59/04:00, 19:59/20:00), P after midnight, month/year rollover, DST change days |
| 20 | Swipe a row right past the threshold and release | The row completes (strike-through, collapse, Undo pill). It **never** stays open showing the grey zone and checkmark. |
| 21 | Swipe a row a little and release | The row snaps back closed |
| 22 | Tap + and type `buy milk` | The first letter stays lowercase |
| 23 | Complete every task in Today | `Done for today.` is shown |
| 24 | Open a new day with an empty Today (nothing completed yet) | `Nothing here. Tap + to add.` is shown |

---

## 8. Development plan (milestones)

1. **Scaffold:** `npx create-expo-app@latest one-day-todo` (TypeScript + Expo Router template); `git init`; push to a private GitHub repo; set `userInterfaceStyle: light`; run in Expo Go.
2. **Data layer:** SQLite schema, repos, and the Zustand store; add/list/delete working.
3. **Main screen UI:** header, rows (pixel-matched to the spec), FAB, input bar, empty state.
4. **Complete flow:** swipe right, the Undo pill, commit logic, haptic, fade-out.
5. **Day logic:** `dates.ts` (logical day, E/P), `rollover.ts`, the `useDayClock` hook; unit tests.
6. **Carry-over sheet**, the counter, and the fallback link.
7. **Settings modal** and notifications.
8. ~~Backup export/import~~ (removed in v3).
9. **Polish and test** on the iPhone against section 7.
10. *(Later, postponed)* EAS store build or development build.

Commit and push after each milestone.

---

## 9. Commands (Windows + iPhone)

```bash
npx create-expo-app@latest one-day-todo
```
```bash
npx expo install expo-sqlite expo-notifications expo-haptics expo-crypto react-native-gesture-handler react-native-reanimated @react-native-community/datetimepicker
```
```bash
npm install zustand
```
```bash
npx expo start
```
Scan the QR code with the iPhone Camera app, which opens it in Expo Go. The phone and the PC must be on the same Wi-Fi network. If they aren't, use `npx expo start --tunnel`.

---

## 10. Decision log (BA review, v2)

| Proposal | Decision |
|---|---|
| Day ends at a configurable time (default 04:00) instead of midnight | **Accepted** |
| Morning catch-up for unreviewed leftovers | **Rejected**: unfinished tasks are deleted at day end if not moved |
| Safer completion (swipe + Undo pill) | **Accepted**. Tap-to-edit was later removed: tasks can't be edited (v4) |
| Carry-over counter (×N, unchecked at ≥3) | **Accepted** |
| Daily "N done" progress line | **Rejected**: "done and forget" |
| Store/dev build | **Postponed**. Code backup via git/GitHub |
| Task backup (JSON export/import) | **Removed (v3)**: deleted and done tasks are permanent; the only way back is the Undo button (2s) |
| Home/lock screen widget | **Rejected** |
| Soft task-limit hint | **Rejected** (v2). Replaced in v5 by a hard limit of 10 **open** tasks per list |
| Move limit | **Accepted (v5)**: max 5 moves |
| "Done for today." closure line | **Accepted (v6)**: the only "reward" is the empty list, named |
| Evening re-commit (all unchecked) | **Accepted (v6)**: replaces the ×3 nudge |
| "Most important first" placeholder | **Rejected (v6)** |
| Reminder text / 21:00 default | **Rejected (v6)**: keep `Plan tomorrow` / `Write tomorrow's list.` at 20:00 |
| Streaks, stats, badges, confetti, categories, Pomodoro, morning reminder | **Rejected (v6)**: they break the "empty list is the only reward" spirit |
| Auto-scroll to a new task | **Accepted (v5)** |
| Move sheet: text + ✓ selection, no sheet when Tomorrow is full, `Let them go` | **Accepted (v7)** |

## 11. Out of scope (do NOT build)

Accounts or login, cloud sync, any task backup or export/import, history or statistics, progress counters, recurring tasks, due times, priorities, notes, categories or multiple lists, reordering, search, widgets, dark mode, localization, iPad layout, a morning catch-up prompt.
