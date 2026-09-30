# Task QUALITY-01: linting, interaction tests, CI, error screen, visible failures

Start after REFACTOR-01 is fully committed. The spec is `docs/TODO_APP_SPEC.md`.
**No user-visible behaviour changes**, except the new error screen (item 4). If the linter or the new tests expose a **real bug**, fix it in a **separate commit** and list it in your final message.

Baseline: `npm run typecheck` and `npm test` pass; note the test count. One commit per section.

---

## 1. ESLint + Prettier (high)
- Run `npx expo lint` once. It installs and configures `eslint` + `eslint-config-expo` (flat config, `eslint.config.js`).
- Add Prettier: `npx expo install prettier eslint-config-prettier eslint-plugin-prettier --dev`, and add `.prettierrc` matching the **current** code style (2 spaces, single quotes, trailing commas `es5`, `printWidth` 120). Check the existing files first; reformatting should be close to a no-op.
- Make sure `react-hooks/rules-of-hooks` is an **error** and `react-hooks/exhaustive-deps` is a **warning**. Fix every hooks warning properly (don't blanket-disable it). Where a dependency is deliberately left out (for example callbacks that read `useAppStore.getState()`), use a one-line `// eslint-disable-next-line react-hooks/exhaustive-deps -- <reason>`.
- Scripts: `"lint": "expo lint"`, `"format": "prettier --write ."`, `"check": "npm run typecheck && npm run lint && npm test"`.
- Result: `npm run lint` has **0 errors and 0 warnings**.

## 2. Interaction tests with React Native Testing Library (high)
- `npx expo install @testing-library/react-native --dev`. Use the `jest-expo` preset.
- **Mocks:**
  - expo-sqlite: an in-memory fake with the same repo API, or mock the `tasksRepo`/`settingsRepo` modules.
  - expo-haptics, expo-notifications, expo-splash-screen: no-ops.
  - Reanimated: its official Jest setup.
  - gesture-handler: `react-native-gesture-handler/jestSetup`.
  - Timers: use Jest fake timers for the 2s Undo window.
- **Tests (screen-level where practical, otherwise component + store):**
  1. Add 2 tasks with Return → both render; the input stays open.
  2. Complete a task (trigger the row's completion callback, or the swipeable's open handler) → the Undo button appears → press Undo → the task is visible again.
  3. Complete 3 tasks → press Undo → all 3 are visible.
  4. Complete a task → advance timers 2s → the task is gone from the store and the repo.
  5. Fill a list to 10 → the footer `Full — finish a task to add more` is shown; pressing + doesn't open the input.
  6. Keyboard hide with a non-empty draft → the task is saved and the input closes. With a full list → the draft is discarded.
  7. Planning mode with Tomorrow full → no carry sheet; the footer shows `Tomorrow is full`.
- Keep them fast (the whole suite under about 20s) and deterministic: fake timers, fixed `now`.

## 3. CI with GitHub Actions (medium)
- `.github/workflows/ci.yml`: on `push` and `pull_request` to `main`, use `ubuntu-latest`, Node 24 with npm cache, then `npm ci` and `npm run check`.
- Add the CI badge to `README.md`.
- Push, then confirm the first run is green with `gh run list --limit 1` if `gh` is available; otherwise tell the owner where to look (GitHub → Actions).

## 4. Error screen (medium)
- In `app/_layout.tsx`, export an Expo Router `ErrorBoundary`. It shows a white screen with centered grey 17pt text `Something went wrong.` and a black text button `Reload` below it.
  - `Reload` calls `retry()` from the boundary props. If the error happens again, a second option `Restart app` uses `Updates.reloadAsync()` from `expo-updates`, which is already installed.
- Log the error with `console.error` (visible in Metro).
- Add a test: a component that throws, rendered under the boundary, shows `Something went wrong.`

## 5. Failures stay visible in development (low)
- Replace the silent `.catch(() => {})` on **reminder scheduling** (`applyReminderSchedule` calls in the store) with a small helper `logDevError(context, error)` that calls `console.warn` only when `__DEV__` is set.
- Haptics and splash-screen `.catch(() => {})` calls can stay silent. Add a short comment on each saying why ("best-effort, never user-visible").
- `init()` failure is already logged. Make sure it goes through the same helper.

---

## Done when
- `npm run check` passes locally **and** in CI. Report the test count before and after.
- `npm run lint` shows 0 errors and 0 warnings.
- The README has the badge and a "Quality checks" section (`npm run check`).
- Commit, push, then `eas update --branch main --message "quality-01" --environment production`, and remind the owner to open the new update in Expo Go.

## Re-test for the owner (2 minutes)
1. Add, complete, Undo and batch Undo work as before.
2. On GitHub → **Actions**, the latest run is green ✅.
