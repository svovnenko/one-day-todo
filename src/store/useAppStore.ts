import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { movableTaskCount, moveTasks, shouldShowCarryPrompt } from '@/logic/carryOver';
import { batchCompletesToday } from '@/logic/completion';
import { CompletionBatch, type CompletionState } from '@/logic/completionBatch';
import { isValidDayEnd, isValidPlanningTime } from '@/logic/dates';
import { logDevError } from '@/logic/devError';
import { freeSlots, isListFull, MAX_TASK_LENGTH } from '@/logic/limits';
import { applyReminderSchedule } from '@/logic/notifications';
import { planRollover } from '@/logic/rollover';
import { reconcileTaskList } from '@/logic/taskListDiff';
import { resolveView } from '@/logic/viewLock';

export type View = 'today' | 'tomorrow';
export type Mode = 'day' | 'planning';

/** Exported so the Undo button's ring animation can't disagree with the store's actual timeout (spec 3.2). */
export const UNDO_WINDOW_MS = 2000;

/** Spec 3.2 batch undo -- tasks stay in SQLite until commit (safe if killed mid-window). `version` bumps per swipe. */
type PendingBatch = {
  tasks: tasksRepo.Task[];
  version: number;
};

type AppState = {
  isReady: boolean;
  settings: settingsRepo.Settings;
  todayDay: string;
  tomorrowDay: string;
  /** Tomorrow is locked in day mode (spec 3.1). */
  mode: Mode;
  todayTasks: tasksRepo.Task[];
  tomorrowTasks: tasksRepo.Task[];
  selectedView: View;
  pendingBatch: PendingBatch | null;
  /** Per-task state while in the pending batch: 'pending' is still animating, 'hidden' once the row's animation finished. */
  completion: Record<string, CompletionState>;
  /** Bumped per task by Undo, so a restored row remounts fresh instead of reversing a part-finished animation in place. */
  restoreVersion: Record<string, number>;
  carrySheetVisible: boolean;
  /** True until revealed -- the screen decides WHEN (focused + active), since a mid-transition sheet can swallow touches on iOS. */
  carryPromptDue: boolean;

  init: () => void;
  refreshTasks: () => void;
  /** In day mode, 'tomorrow' redirects to today (spec 3.1). Returns false if the target list is already full (spec 3.2 v5) -- a safety net; the caller should have already checked. */
  addTask: (view: View, text: string) => boolean;
  /** Adds to the pending batch and restarts its UNDO_WINDOW_MS timer (spec 3.2) -- doesn't commit what was already pending. Called at the swipe threshold so Undo appears immediately. */
  beginComplete: (task: tasksRepo.Task) => void;
  /** The row's completion animation finished -- marks it 'hidden' so visibleTasks drops it. No-op if Undo already restored it. */
  markHidden: (taskId: string) => void;
  undoPending: () => void;
  commitPendingBatch: () => void;
  /** Ignored for 'tomorrow' while in day mode -- Tomorrow can't be selected before planning time (spec 3.1). */
  setSelectedView: (view: View) => void;
  /** Day-end rollover (spec 3.5): commits the batch, purges tasks before today, recomputes day keys, resets the view. */
  runRollover: () => void;
  /** Lighter than runRollover: recomputes mode/default view without purging. */
  refreshMode: () => void;
  /** Sets carryPromptDue if the spec 3.4 conditions are met; doesn't show the sheet itself. */
  evaluateCarryPrompt: () => void;
  showCarrySheetIfDue: () => void;
  hideCarrySheet: () => void;
  /** Fallback link (spec 3.4): reopens the sheet even if already shown today. */
  openCarrySheet: () => void;
  skipCarrySheet: () => void;
  moveCarryOverTasks: (taskIds: string[]) => void;
  /** Persists any given schedule fields, recomputes mode/day keys, and reschedules the reminder (spec 3.6). */
  updateSchedule: (
    partial: Partial<Pick<settingsRepo.Settings, 'planningTime' | 'dayEndTime' | 'reminderEnabled'>>
  ) => void;
  /** Persists the Theme choice and applies it immediately (spec 3.6 v8) -- every component reads it back via useTheme(). */
  updateAppearance: (appearance: settingsRepo.Settings['appearance']) => void;
};

/** Trims, collapses to one line, and caps at MAX_TASK_LENGTH (spec 3.2 v8). Only new input is capped -- an existing longer task is never retroactively truncated. */
function sanitizeTaskText(raw: string): string {
  return raw.replace(/\r?\n/g, ' ').trim().slice(0, MAX_TASK_LENGTH);
}

export const useAppStore = create<AppState>((set, get) => {
  // Owns the batch's timer + per-task state (src/logic/completionBatch.ts); onCommit deletes from SQLite and syncs the store.
  const completionBatch = new CompletionBatch<tasksRepo.Task>(UNDO_WINDOW_MS, (tasks) => {
    tasksRepo.removeMany(tasks.map((t) => t.id));
    // Spec 3.4/4: "Done for today." follows only an actual commit of a batch with at least one today task.
    const { todayDay, settings } = get();
    if (batchCompletesToday(tasks, todayDay)) {
      settingsRepo.setLastCompletedDate(todayDay);
      set({
        pendingBatch: null,
        completion: completionBatch.completion,
        settings: { ...settings, lastCompletedDate: todayDay },
      });
    } else {
      set({ pendingBatch: null, completion: completionBatch.completion });
    }
    get().refreshTasks();
  });

  return {
    isReady: false,
    settings: settingsRepo.DEFAULT_SETTINGS,
    todayDay: '',
    tomorrowDay: '',
    mode: 'day',
    todayTasks: [],
    tomorrowTasks: [],
    selectedView: 'today',
    pendingBatch: null,
    completion: {},
    restoreVersion: {},
    carrySheetVisible: false,
    carryPromptDue: false,

    init: () => {
      let settings = settingsRepo.getSettings();

      // Spec 3.1/3.6 v4: E/P have restricted ranges; an out-of-range
      // stored value (e.g. a leftover test value) resets to default.
      if (!isValidDayEnd(settings.dayEndTime)) {
        settingsRepo.setDayEndTime(settingsRepo.DEFAULT_SETTINGS.dayEndTime);
        settings = { ...settings, dayEndTime: settingsRepo.DEFAULT_SETTINGS.dayEndTime };
      }
      if (!isValidPlanningTime(settings.planningTime)) {
        settingsRepo.setPlanningTime(settingsRepo.DEFAULT_SETTINGS.planningTime);
        settings = { ...settings, planningTime: settingsRepo.DEFAULT_SETTINGS.planningTime };
      }

      set({ settings });
      get().runRollover();
      set({ isReady: true });
      // Best-effort: no reminder just means no "Plan tomorrow" notification, not a broken app.
      applyReminderSchedule(settings).catch((error) => logDevError('applyReminderSchedule (init)', error));
    },

    refreshTasks: () => {
      // Reuses unchanged task references so a rebuilt-but-identical object doesn't defeat React.memo(TaskRow).
      const { todayDay, tomorrowDay, todayTasks, tomorrowTasks } = get();
      set({
        todayTasks: reconcileTaskList(todayTasks, tasksRepo.listByDay(todayDay)),
        tomorrowTasks: reconcileTaskList(tomorrowTasks, tasksRepo.listByDay(tomorrowDay)),
      });
    },

    addTask: (view, text) => {
      const trimmed = sanitizeTaskText(text);
      if (!trimmed) return false;
      const { todayDay, tomorrowDay, mode, todayTasks, tomorrowTasks } = get();
      const effectiveView = resolveView(view, mode);
      const isToday = effectiveView === 'today';
      if (isListFull(isToday ? todayTasks.length : tomorrowTasks.length)) return false;
      tasksRepo.add(isToday ? todayDay : tomorrowDay, trimmed);
      get().refreshTasks();
      return true;
    },

    beginComplete: (task) => {
      completionBatch.add(task);
      set({ pendingBatch: completionBatch.current, completion: completionBatch.completion });
    },

    markHidden: (taskId) => {
      completionBatch.markHidden(taskId);
      set({ completion: completionBatch.completion });
    },

    undoPending: () => {
      // Nothing to restore in SQLite -- the batch's tasks were never deleted.
      completionBatch.cancel();
      set({
        pendingBatch: null,
        completion: completionBatch.completion,
        restoreVersion: completionBatch.restoreVersion,
      });
    },

    commitPendingBatch: () => {
      completionBatch.commit(); // no-ops if nothing is pending; otherwise its onCommit (above) syncs the store
    },

    setSelectedView: (view) => set({ selectedView: resolveView(view, get().mode) }),

    runRollover: () => {
      get().commitPendingBatch(); // spec 3.5: commit the pending batch before purging
      const { settings } = get();
      const now = new Date();
      const { todayDay, tomorrowDay, mode, defaultView } = planRollover(now, settings);
      tasksRepo.purgeBefore(todayDay);
      set({
        todayDay,
        tomorrowDay,
        mode,
        selectedView: defaultView,
        todayTasks: tasksRepo.listByDay(todayDay),
        tomorrowTasks: tasksRepo.listByDay(tomorrowDay),
      });
      get().evaluateCarryPrompt();
    },

    refreshMode: () => {
      const { settings } = get();
      const now = new Date();
      const { mode, defaultView } = planRollover(now, settings);
      set({ mode, selectedView: defaultView });
      get().evaluateCarryPrompt();
    },

    evaluateCarryPrompt: () => {
      const { settings, todayDay, todayTasks, tomorrowTasks } = get();
      const now = new Date();
      const due = shouldShowCarryPrompt(
        now,
        settings,
        todayDay,
        settings.lastCarryPromptDate,
        movableTaskCount(todayTasks),
        freeSlots(tomorrowTasks.length)
      );
      if (due) set({ carryPromptDue: true });
    },

    showCarrySheetIfDue: () => {
      if (get().carryPromptDue) set({ carryPromptDue: false, carrySheetVisible: true });
    },

    hideCarrySheet: () => set({ carrySheetVisible: false }),

    openCarrySheet: () => set({ carrySheetVisible: true }),

    skipCarrySheet: () => {
      const { todayDay, settings } = get();
      settingsRepo.setLastCarryPromptDate(todayDay);
      set({
        settings: { ...settings, lastCarryPromptDate: todayDay },
        carrySheetVisible: false,
        carryPromptDue: false,
      });
    },

    moveCarryOverTasks: (taskIds) => {
      const { todayDay, tomorrowDay, settings } = get();
      moveTasks(taskIds, todayDay, tomorrowDay);
      settingsRepo.setLastCarryPromptDate(todayDay);
      set({
        settings: { ...settings, lastCarryPromptDate: todayDay },
        carrySheetVisible: false,
        carryPromptDue: false,
      });
      get().refreshTasks();
    },

    updateSchedule: (partial) => {
      if (partial.planningTime !== undefined) settingsRepo.setPlanningTime(partial.planningTime);
      if (partial.dayEndTime !== undefined) settingsRepo.setDayEndTime(partial.dayEndTime);
      if (partial.reminderEnabled !== undefined) settingsRepo.setReminderEnabled(partial.reminderEnabled);

      const settings = { ...get().settings, ...partial };
      set({ settings });
      get().runRollover(); // spec 3.6: recompute the mode immediately
      // Best-effort, same as init()'s call -- see the comment there.
      applyReminderSchedule(settings).catch((error) => logDevError('applyReminderSchedule (updateSchedule)', error));
    },

    updateAppearance: (appearance) => {
      settingsRepo.setAppearance(appearance);
      set({ settings: { ...get().settings, appearance } });
    },
  };
});
