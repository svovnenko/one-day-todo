import type * as TasksRepoModule from '@/db/tasksRepo';
import type { Task } from '@/db/tasksRepo';
import { isPlanningMode } from '@/logic/dates';

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

/** Tasks with carry_count >= 3 start unchecked -- a nudge to drop them or do them now. */
export function defaultChecked(task: Task): boolean {
  return task.carryCount < 3;
}

/**
 * Moves the given tasks from `fromDay` to `toDay`, incrementing their carry
 * count. If a task with the same text already exists in `toDay`, it isn't
 * duplicated -- that task's carry count becomes
 * max(existing, moved + 1) instead, and the moved-from row is dropped
 * (spec 3.4). This is the one DB-touching export of this module, so it
 * `require()`s tasksRepo lazily instead of importing it at module scope --
 * that keeps shouldShowCarryPrompt/defaultChecked importable (and unit
 * testable) without pulling in expo-sqlite's native binding.
 */
export function moveTasks(taskIds: string[], fromDay: string, toDay: string): void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const tasksRepo: typeof TasksRepoModule = require('@/db/tasksRepo');
  const idSet = new Set(taskIds);
  for (const task of tasksRepo.listByDay(fromDay)) {
    if (!idSet.has(task.id)) continue;
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
