// Manual Jest mock for src/db/tasksRepo.ts (jest.setup.ts's
// jest.mock('@/db/tasksRepo')) -- an in-memory table so useAppStore's
// real logic runs under Jest without expo-sqlite. Reset via __tests__/testUtils/fakeRepos.ts.
import type { Task } from '../tasksRepo';

let tasks: Task[] = [];
let counter = 0;

function maxPosition(day: string): number {
  return tasks.filter((t) => t.day === day).reduce((max, t) => Math.max(max, t.position), 0);
}

export function listByDay(day: string): Task[] {
  return tasks
    .filter((t) => t.day === day)
    .slice()
    .sort((a, b) => a.position - b.position);
}

export function add(day: string, text: string): Task {
  const task: Task = {
    id: `mock-task-${++counter}`,
    text,
    day,
    position: maxPosition(day) + 1,
    carryCount: 0,
    createdAt: Date.now(),
  };
  tasks.push(task);
  return task;
}

export function remove(id: string): void {
  tasks = tasks.filter((t) => t.id !== id);
}

export function removeMany(ids: string[]): void {
  const idSet = new Set(ids);
  tasks = tasks.filter((t) => !idSet.has(t.id));
}

export function findByDayAndText(day: string, text: string): Task | null {
  return tasks.find((t) => t.day === day && t.text === text) ?? null;
}

export function moveToDay(id: string, day: string, carryCount: number): void {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.day = day;
  task.position = maxPosition(day) + 1;
  task.carryCount = carryCount;
}

export function setCarryCount(id: string, carryCount: number): void {
  const task = tasks.find((t) => t.id === id);
  if (task) task.carryCount = carryCount;
}

export function purgeBefore(dayKey: string): number {
  const before = tasks.length;
  tasks = tasks.filter((t) => t.day >= dayKey);
  return before - tasks.length;
}

/** Test-only: empties the in-memory table. */
export function __reset(): void {
  tasks = [];
  counter = 0;
}

/** Test-only: the raw in-memory table, for "gone from the repo" assertions. */
export function __getAll(): Task[] {
  return tasks;
}
