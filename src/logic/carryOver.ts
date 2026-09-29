import type * as TasksRepoModule from '@/db/tasksRepo';
import type { Task } from '@/db/tasksRepo';
import { isPlanningMode } from '@/logic/dates';
import { MAX_CARRY_COUNT } from '@/logic/limits';

export type CarryOverSettings = {
  planningTime: string;
  dayEndTime: string;
};

/**
 * Spec 3.4: show the "move unfinished to tomorrow" sheet when the app is
 * active in planning mode, today has at least one unfinished task, and the
 * prompt hasn't already been shown for this logical day.
 */
export function shouldShowCarryPrompt(
  now: Date,
  settings: CarryOverSettings,
  todayDayKey: string,
  lastCarryPromptDate: string | null,
  todayTaskCount: number
): boolean {
  if (!isPlanningMode(now, settings.planningTime, settings.dayEndTime)) return false;
  if (todayTaskCount < 1) return false;
  if (lastCarryPromptDate === todayDayKey) return false;
  return true;
}

/** Spec 3.4 v5: a task moved MAX_CARRY_COUNT times can't be moved again -- it stays in Today. */
export function isBlockedFromMoving(task: Task): boolean {
  return task.carryCount >= MAX_CARRY_COUNT;
}

export type CarryOverCandidate = {
  task: Task;
  /** carry_count >= MAX_CARRY_COUNT -- greyed out, can't be checked or moved at all. */
  blocked: boolean;
  /** A task with the same text already exists in tomorrow's list -- moving this one merges into it (spec 3.4) rather than appending a new row, so it never consumes one of tomorrow's free slots. */
  deduplicates: boolean;
};

/** Builds the per-task decision data the carry-over sheet needs, from today's unfinished tasks and tomorrow's current list. */
export function buildCarryOverCandidates(todayTasks: Task[], tomorrowTasks: Task[]): CarryOverCandidate[] {
  const tomorrowTextsInUse = new Set(tomorrowTasks.map((t) => t.text));
  return todayTasks.map((task) => ({
    task,
    blocked: isBlockedFromMoving(task),
    deduplicates: tomorrowTextsInUse.has(task.text),
  }));
}

/**
 * Moves the given tasks from `fromDay` to `toDay`, incrementing their carry
 * count. Tasks at or past MAX_CARRY_COUNT are skipped as a safety net
 * (spec 3.4 v5) even if the caller passed one -- the UI shouldn't let that
 * happen, but this is the last line of defense. If a task with the same
 * text already exists in `toDay`, it isn't duplicated -- that task's carry
 * count becomes max(existing, moved + 1) instead, and the moved-from row is
 * dropped (spec 3.4). This is the one DB-touching export of this module, so
 * it `require()`s tasksRepo lazily instead of importing it at module scope
 * -- that keeps the pure decision functions above importable (and unit
 * testable) without pulling in expo-sqlite's native binding.
 */
export function moveTasks(taskIds: string[], fromDay: string, toDay: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tasksRepo: typeof TasksRepoModule = require('@/db/tasksRepo');
  const idSet = new Set(taskIds);
  for (const task of tasksRepo.listByDay(fromDay)) {
    if (!idSet.has(task.id)) continue;
    if (isBlockedFromMoving(task)) continue;
    const movedCarryCount = task.carryCount + 1;
    const existing = tasksRepo.findByDayAndText(toDay, task.text);
    if (existing) {
      tasksRepo.setCarryCount(existing.id, Math.max(existing.carryCount, movedCarryCount));
      tasksRepo.remove(task.id);
    } else {
      tasksRepo.moveToDay(task.id, toDay, movedCarryCount);
    }
  }
}
