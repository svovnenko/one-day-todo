# One-Day To-Do — Product & Technical Spec

> Handoff document for the development session. Everything here was agreed with the owner on 2026-09-29 (v2, after the business-analyst review).
> Build exactly this; anything not listed is out of scope. When in doubt, choose the simpler option.

---

## 1. Product summary

A minimal "paper notepad" to-do app for iPhone. It holds **one day at a time**:

- You write a plain list of tasks for **today** (and, from the evening onward, for **tomorrow**).
- **Swipe right** on a task to complete it. It is struck through and removed, and a short **Undo** pill appears. After that it is permanently deleted, with no history ("done and forget").
- At a configurable **planning time** (default **20:00**) the app switches to **Tomorrow** so you can plan the next day, and offers to **move unfinished tasks** there. Tasks that keep getting moved show a small **carry-over counter** (×2, ×3…).
- At a configurable **day-end time** (default **04:00**, not midnight, so a late night still counts as today), whatever is left of today is **permanently deleted**. Tomorrow becomes Today.
- **Manual backup:** export and import a JSON file through the iOS share sheet, from Settings.
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
| Backup | `expo-file-system` + `expo-sharing` (export), `expo-document-picker` (import) | All work in Expo Go; no server |
| Haptics | `expo-haptics` | Light tap on complete |
| Backend / cloud | **None** | |
| UI language | **English only** | No i18n library |
| Theme | **Light only** (force white, even in iOS dark mode) | Matches the reference design |

**Hard rule:** install packages only with `npx expo install <pkg>`, and only packages that run in Expo Go. **Do not** use MMKV, Realm, or any library that needs a custom dev client.

**Known limitations (accepted by the owner):**
- Data lives inside Expo Go's sandbox, so deleting Expo Go deletes the tasks. The **JSON export** is the mitigation, and it is also how to migrate to a future store build.
- A new Expo Go release may need the project to be upgraded (`npx expo install expo@latest && npx expo install --fix`) before it opens again. Export a backup before any upgrade.

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
- **Validation in Settings:** P must be different from E. Any P is otherwise allowed, because the offset math handles wrap-around. Picking P right after E shows the hint "Planning time is right after day end". It is not blocked.
- The header toggle is **always visible**. The user can switch views manually at any time. When the app becomes active or crosses P or E, the view resets to the mode default.

### 3.2 Tasks
- A task is **text only** (single line, trimmed, 1–200 chars; empty input is ignored).
- New tasks are **appended to the bottom** of the currently viewed list (Today or Tomorrow).
- **Swipe right** on a task → it completes:
  - A light haptic fires; the row shows strike-through and grey briefly, then collapses with a 150ms fade.
  - An **Undo pill** appears at the bottom center: `Done · Undo`. It is dark `#1C1C1E` with white 15pt text, a rounded pill, and sits above the FAB and the safe area.
  - It stays for **4 seconds**. Tapping **Undo** restores the task to its original position.
  - After 4 seconds, or when another task is completed (only one pending undo at a time; the previous one is committed), the task is **deleted permanently**.
- **Tap** a task → edit its text (reuses the input bar, prefilled). Saving empty text deletes the task (also with the Undo pill).
- A tap never completes a task, which prevents accidental deletions.
- No reordering, no due dates, no notes.

### 3.3 Adding (input)
- A **floating round button** sits at the bottom-left: a white circle with a soft shadow and a **"+"** icon (replaces the ↓ button in the reference screenshot).
- Tapping it opens a **text input bar docked above the keyboard** (placeholder: `New task`).
- **Return** adds the task, clears the field, and **keeps the keyboard open** for fast entry of several lines.
- Tapping outside the field or pressing the keyboard dismiss closes the input. Any non-empty text is saved first.

### 3.4 Carry-over (moving unfinished tasks) + counter
- When the app is active **in planning mode**, today has **≥1 unfinished task**, and the prompt hasn't been shown yet for this logical day, show a **bottom sheet**:
  - Title: `Move unfinished to tomorrow?`
  - A list of today's unfinished tasks, each with a checkbox and its counter if it has one.
  - Checked by default, **except tasks with `carry_count >= 3`**, which start unchecked (a nudge to drop them or do them now).
  - Buttons: `Move` (primary) and `Skip`
- **Move** transfers the checked tasks: they are deleted from Today and appended to Tomorrow with **`carry_count + 1`**.
  - If a task with the exact same text already exists in Tomorrow, don't duplicate it. Set that existing task's `carry_count = max(existing, moved + 1)`.
- **Move** and **Skip** both mark the prompt as shown (`lastCarryPromptDate = today`).
- A fallback: in planning mode, the **Today** view shows a small grey text link at the list end, `Move unfinished to tomorrow`. It reopens the sheet.
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
  - `Planning time`: a time picker (default **20:00**)
  - `Day ends at`: a time picker (default **04:00**), with the caption: "Tasks left after this time are deleted."
  - `Daily reminder`: an on/off switch (default **on**)
- **Backup**
  - `Export backup`: see 3.8
  - `Import backup`: see 3.8

Changing any time setting reschedules the notification immediately and recomputes the mode.

### 3.7 Reminder notification
- A local notification **repeating daily** at P: title `Plan tomorrow`, body `Write tomorrow's list.`
- Ask for notification permission on first launch. If permission is denied, the app works normally with no reminder.
- Use a daily trigger (`{ type: SchedulableTriggerInputTypes.DAILY, hour, minute }`). Cancel all scheduled notifications and reschedule whenever the settings change.
- Tapping the notification opens the app in planning mode, so the carry-over sheet appears when it applies.

### 3.8 Backup (export / import)
- **Export:** build the JSON below, write it to `FileSystem.cacheDirectory` as `one-day-todo-YYYY-MM-DD.json`, then open the **iOS share sheet** (`Sharing.shareAsync`) so the user can save it to Files or iCloud Drive, AirDrop it, or send it by mail.
  ```json
  {
    "app": "one-day-todo",
    "version": 1,
    "exportedAt": "2026-09-29T21:14:00+03:00",
    "settings": { "planningTime": "20:00", "dayEndTime": "04:00", "reminderEnabled": true },
    "tasks": [ { "text": "Call bank", "day": "2026-09-30", "position": 1, "carryCount": 2 } ]
  }
  ```
  Tasks that are pending undo are excluded.
- **Import:** use `DocumentPicker.getDocumentAsync({ type: 'application/json' })`, read the file, and validate it (`app` and `version`, field types, text length). An invalid file shows the alert "This file is not a valid backup." and changes nothing.
  - Then confirm with an alert: `Replace current tasks and settings with this backup?` → `Replace` or `Cancel`.
  - On Replace: in one SQLite transaction, delete all tasks, insert the backup's tasks, and write the settings. Then run the rollover. Tasks from days before today are dropped by the normal rule, and the alert says so: "N old tasks were skipped."
- This is also the **migration path** to a future store build: export from Expo Go, then import in the new app.

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
| Header | One line, 15pt, grey `#8E8E93`: `Today · Tue 29 Sep` and `Tomorrow · Wed 30 Sep` as two tappable labels (logical dates). The selected label is black and medium weight. The gear icon (18pt, grey) sits on the right. Follow safe areas. |
| FAB | 56pt white circle, bottom-left (16pt from edges, above the safe area), shadow (opacity 0.15, radius 8, offset y 2), black "+" 24pt |
| Undo pill | Bottom center, 44pt tall, `#1C1C1E` background, white 15pt text `Done · Undo`, slides up and fades out |
| Input bar | Docked above the keyboard, white, 1px top border `#E5E5EA`, 17pt text, 16pt padding |
| Empty state | Centered grey 17pt: `Nothing here. Tap + to add.` |
| Carry-over sheet | White bottom sheet with a rounded top (16pt), a simple checkbox list, and full-width black `Move` and grey text `Skip` buttons |
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
-- keys: planningTime ('20:00'), dayEndTime ('04:00'), reminderEnabled ('1'), lastCarryPromptDate ('YYYY-MM-DD')
```

- There is no `done` column. Completion is pending in memory during the 4-second undo window, then the row is deleted. If the app is killed during the window, the task survives, which is the safe failure.
- Date keys are built manually from `getFullYear/getMonth/getDate`. **Never** use `toISOString()`, which returns UTC.
- Use `PRAGMA user_version` for migrations (v1 = the schema above).

---

## 6. Project structure

```
app/
  _layout.tsx          # Stack + GestureHandlerRootView; runs init (db, rollover, notifications) before rendering
  index.tsx            # Main list screen (header, list, FAB, input bar, undo pill, carry-over sheet)
  settings.tsx         # Modal: schedule + backup
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
    backup.ts          # buildExport(), validateImport(json), applyImport()
  hooks/
    useDayClock.ts     # AppState listener + timers to next E and next P → rollover / mode refresh
  components/
    Header.tsx
    TaskRow.tsx        # swipe right → complete; tap → edit; shows ×N
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
| 2 | Swipe right on a task | It is struck through and removed; the Undo pill shows for 4s; the task is still gone after an app restart |
| 3 | Swipe right, then tap Undo | The task returns to its original position |
| 4 | Complete task A, then task B within 4s | A is committed (deleted); the pill now refers to B |
| 5 | Tap a task, change the text, save | The text is updated; nothing is completed |
| 6 | Open the app at 14:00 | Today is selected |
| 7 | Open the app at 20:05 with 2 unfinished tasks today | Tomorrow is selected; the carry-over sheet lists 2 checked tasks |
| 8 | Move a task that has `carry_count` 0 | It appears in Tomorrow as `Task ×1` |
| 9 | A task with ×3 appears in the carry-over sheet | It is unchecked by default |
| 10 | Tap Skip, then reopen the app | The sheet does not reappear; the fallback link is visible in the Today view |
| 11 | Open the app at 01:30 (E=04:00) | Still the same logical day: the header shows yesterday's calendar date as "Today"; the lists are unchanged; planning mode |
| 12 | Open the app at 04:10 | The old today's tasks are gone; the former Tomorrow is now Today; day mode |
| 13 | Keep the app open across 04:00 | The list rolls over without a restart |
| 14 | Change P to 21:30 and E to 05:00 | The notification is rescheduled; the mode and rollover use the new times |
| 15 | Export, delete a few tasks, then import the file | The tasks and settings are restored; old-day tasks are skipped with a message |
| 16 | Import a random non-backup JSON file | The alert "not a valid backup" appears; nothing changes |
| 17 | Deny notification permission | The app works; no crash |
| 18 | iOS dark mode is on | The app is still white |
| 19 | Unit tests for `dates.ts` | Cover E/P boundaries (03:59/04:00, 19:59/20:00), P after midnight, month/year rollover, DST change days |

---

## 8. Development plan (milestones)

1. **Scaffold:** `npx create-expo-app@latest one-day-todo` (TypeScript + Expo Router template); `git init`; push to a private GitHub repo; set `userInterfaceStyle: light`; run in Expo Go.
2. **Data layer:** SQLite schema, repos, and the Zustand store; add/list/delete working.
3. **Main screen UI:** header, rows (pixel-matched to the spec), FAB, input bar, empty state.
4. **Complete flow:** swipe right, the Undo pill, commit logic, haptic, fade-out; tap to edit.
5. **Day logic:** `dates.ts` (logical day, E/P), `rollover.ts`, the `useDayClock` hook; unit tests.
6. **Carry-over sheet**, the counter, and the fallback link.
7. **Settings modal** and notifications.
8. **Backup** export/import.
9. **Polish and test** on the iPhone against section 7.
10. *(Later, postponed)* EAS store build or development build.

Commit and push after each milestone.

---

## 9. Commands (Windows + iPhone)

```bash
npx create-expo-app@latest one-day-todo
```
```bash
npx expo install expo-sqlite expo-notifications expo-haptics expo-crypto expo-file-system expo-sharing expo-document-picker react-native-gesture-handler react-native-reanimated @react-native-community/datetimepicker
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
| Safer completion (swipe + Undo pill) | **Accepted**: tap now edits |
| Carry-over counter (×N, unchecked at ≥3) | **Accepted** |
| Daily "N done" progress line | **Rejected**: "done and forget" |
| Store/dev build | **Postponed**. Backup is needed now → JSON export/import + git/GitHub for the code |
| Home/lock screen widget | **Rejected** |
| Soft task-limit hint | **Rejected** |

## 11. Out of scope (do NOT build)

Accounts or login, cloud sync, automatic backup, history or statistics, progress counters, recurring tasks, due times, priorities, notes, categories or multiple lists, reordering, search, widgets, dark mode, localization, iPad layout, a morning catch-up prompt.
