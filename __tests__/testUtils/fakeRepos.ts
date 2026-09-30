// Typed access to the in-memory fake repos (src/db/__mocks__/), which
// jest.setup.ts substitutes for the real SQLite-backed repos in every
// test file. Importing '@/db/tasksRepo' normally only exposes the REAL
// module's types (Jest swaps the implementation, not the type), so the
// mock-only __reset/__getAll helpers are accessed here through one
// narrowly-scoped cast instead of scattering `as any` across every test.
import * as tasksRepo from '@/db/tasksRepo';
import * as settingsRepo from '@/db/settingsRepo';
import type { Task } from '@/db/tasksRepo';
import type { Settings } from '@/db/settingsRepo';

type TasksRepoMock = typeof tasksRepo & {
  __reset: () => void;
  __getAll: () => Task[];
};

type SettingsRepoMock = typeof settingsRepo & {
  __reset: (overrides?: Partial<Settings>) => void;
};

const tasksRepoMock = tasksRepo as TasksRepoMock;
const settingsRepoMock = settingsRepo as SettingsRepoMock;

/** Empties both fake repos; call in `beforeEach` so tests don't leak state into each other. */
export function resetFakeRepos(settingsOverrides?: Partial<Settings>): void {
  tasksRepoMock.__reset();
  settingsRepoMock.__reset(settingsOverrides);
}

/** The fake tasks table's raw contents, for "gone from the repo" assertions. */
export function getAllFakeTasks(): Task[] {
  return tasksRepoMock.__getAll();
}
