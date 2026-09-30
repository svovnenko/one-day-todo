import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { movableTaskCount, moveTasks, shouldShowCarryPrompt } from '@/logic/carryOver';
import { batchCompletesToday } from '@/logic/completion';
import { CompletionBatch, type CompletionState } from '@/logic/completionBatch';
import { isValidDayEnd, isValidPlanningTime } from '@/logic/dates';
import { logDevError } from '@/logic/devError';
import { freeSlots, isListFull } from '@/logic/limits';
import { applyReminderSchedule } from '@/logic/notifications';
import { planRollover } from '@/logic/rollover';
import { reconcileTaskList } from '@/logic/taskListDiff';
import { resolveView } from '@/logic/viewLock';

export type View = 'today' | 'tomorrow';
export type Mode = 'day' | 'planning';

/** Exported so the Undo button's ring animation can't disagree with the store's actual timeout (spec 3.2). */
export const UNDO_WINDOW_MS = 2000;

/**
 * The tasks the user has swiped since the last commit/undo (spec 3.2:
 * batch undo), as exposed to the UI. They stay in SQLite untouched until
 * the batch commits, so killing the app mid-window loses nothing (spec
 * section 5) -- only the UI hides them and shows the Undo button. Every
 * new swipe appends to `tasks` and restarts the countdown (owned by the
 * CompletionBatch below) -- it does NOT commit the earlier ones.
 * `version` increments on every append, purely so the UI (the Undo
 * button's ring) can tell "a new task joined" apart from "an unrelated
 * re-render" without keying off any single task's id.
 */
type PendingBatch = {
  tasks: tasksRepo.Task[];
  version: number;
};

type AppState = {
  isReady: boolean;
  settings: settingsRepo.Settings;
  /** Logical-date keys ('YYYY-MM-DD') for the two lists currently shown. */
  todayDay: string;
  tomorrowDay: string;
  /** Tomorrow is locked (and hidden/unwritable) in day mode -- spec 3.1. Independent of selectedView, which the user can override manually only in planning mode. */
  mode: Mode;
  todayTasks: tasksRepo.Task[];
  tomorrowTasks: tasksRepo.Task[];
  selectedView: View;
  pendingBatch: PendingBatch | null;
  /**
   * Per-task row state while it's in the pending batch: 'pending' means
   * still animating out (or never removed from the data yet); 'hidden'
   * means the row's own animation has finished. A task with no entry here
   * is unaffected by any batch. Owns everything the screen used to track
   * itself as `hiddenRowIds`.
   */
  completion: Record<string, CompletionState>;
  /**
   * Bumped per task by Undo, so a restored row's component remounts
   * fresh instead of trying to reverse a part-finished animation in
   * place. Replaces the screen's own `restoreCounts`.
   */
  restoreVersion: Record<string, number>;
  /** Whether the "Move unfinished to tomorrow?" bottom sheet is showing (spec 3.4). */
  carrySheetVisible: boolean;
  /**
   * True when evaluateCarryPrompt's conditions are met but the sheet
   * hasn't been revealed yet. Kept separate from carrySheetVisible so the
   * store never presents the sheet itself -- the main screen decides WHEN
   * to reveal it (only while focused and the app is active): presenting
   * it while a native screen transition or AppState transition is in
   * flight could otherwise leave an invisible layer swallowing every
   * touch on iOS.
   */
  carryPromptDue: boolean;

  /** Opens the DB, loads settings + today/tomorrow's tasks, and picks the default view. */
  init: () => void;
  /** Re-reads today/tomorrow's tasks from SQLite into state. */
  refreshTasks: () => void;
  /**
   * In day mode, a 'tomorrow' target is redirected to today -- Tomorrow
   * doesn't exist yet (spec 3.1). Returns false (and adds nothing) if the
   * target list is already at OPEN_TASK_LIMIT (spec 3.2 v5) -- the caller
   * is expected to have already checked this in the common case, but the
   * store enforces it too as a safety net.
   */
  addTask: (view: View, text: string) => boolean;
  /**
   * Adds a task to the pending batch and restarts its UNDO_WINDOW_MS
   * timer -- it does NOT commit whatever was already pending (spec 3.2:
   * batch undo). Called at the swipe threshold, not after the row's own
   * strike-through/fade/collapse animation finishes, so the Undo button
   * appears immediately.
   */
  beginComplete: (task: tasksRepo.Task) => void;
  /**
   * The row's own completion animation (strike-through, fade, collapse)
   * has finished -- marks it 'hidden' so `visibleTasks` drops it from the
   * list. A no-op if the task isn't in the batch any more (Undo already
   * restored it, or the batch already committed some other way).
   */
  markHidden: (taskId: string) => void;
  /** Restores every task in the batch (they were never deleted) and clears it. */
  undoPending: () => void;
  /** Permanently deletes every task in the batch, in one transaction (timeout, rollover, or backgrounding). */
  commitPendingBatch: () => void;
  /** Ignored for 'tomorrow' while in day mode -- Tomorrow can't be selected before planning time (spec 3.1). */
  setSelectedView: (view: View) => void;
  /**
   * Day-end rollover (spec 3.5): commits the pending batch first, deletes
   * every task whose day is before today, recomputes today/tomorrow's day
   * keys, and resets the view to the mode default. Runs on launch, on
   * AppState becoming active, and on the in-foreground timer to the next E.
   */
  runRollover: () => void;
  /**
   * Lighter than runRollover: just recomputes the mode/default view,
   * without purging. Runs on the in-foreground timer to the next planning
   * time P.
   */
  refreshMode: () => void;
  /** Sets carryPromptDue if the spec 3.4 conditions are currently met. Called after runRollover/refreshMode; doesn't show the sheet itself. */
  evaluateCarryPrompt: () => void;
  /** Consumes a due prompt and actually reveals the sheet. Called only by the main screen, gated on focus + AppState active. */
  showCarrySheetIfDue: () => void;
  /** Unconditionally hides the sheet. Safe to call any time, including as a guaranteed-hide fallback after a failed Skip/Move. */
  hideCarrySheet: () => void;
  /** Fallback link (spec 3.4): reopens the sheet even if already shown today. */
  openCarrySheet: () => void;
  /** "Skip": marks the prompt as shown for today and closes the sheet. */
  skipCarrySheet: () => void;
  /** "Move": moves the checked tasks to tomorrow, marks the prompt shown, and closes the sheet. */
  moveCarryOverTasks: (taskIds: string[]) => void;
  /**
   * Persists any of planningTime/dayEndTime/reminderEnabled that are
   * given, immediately recomputes the mode/day keys, and reschedules (or
   * cancels) the daily reminder notification (spec 3.6).
   */
  updateSchedule: (
    partial: Partial<Pick<settingsRepo.Settings, 'planningTime' | 'dayEndTime' | 'reminderEnabled'>>
  ) => void;
};

/** Trims, collapses to a single line, and caps length per spec 3.2 (1-200 chars). */
function sanitizeTaskText(raw: string): string {
  return raw.replace(/\r?\n/g, ' ').trim().slice(0, 200);
}

export const useAppStore = create<AppState>((set, get) => {
  // Owns the batch's timer lifecycle (add/restart/commit/cancel) AND the
  // per-task completion/restoreVersion state; see
  // src/logic/completionBatch.ts. onCommit does the actual SQLite deletes
  // (in one transaction) and syncs the store once the batch resolves,
  // whether via timeout, rollover, or backgrounding.
  const completionBatch = new CompletionBatch<tasksRepo.Task>(UNDO_WINDOW_MS, (tasks) => {
    tasksRepo.removeMany(tasks.map((t) => t.id));
    // Spec 3.4/4: "Done for today." only follows an actual commit (not
    // Undo, which cancels the batch before it gets here) of a batch that
    // included at least one today task (not a tomorrow-only batch).
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

      // Spec 3.1/3.6 v4: E and P now have restricted ranges (E is a whole
      // hour 00:00-04:00, P is 12:00-23:59). A stored value outside those
      // ranges (e.g. a leftover test value) is reset to the default and
      // saved back, so the header dates stay meaningful.
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
      // Reschedules under the (possibly corrected) settings. Best-effort:
      // no reminder just means the user doesn't get a "Plan tomorrow"
      // notification, not a broken app.
      applyReminderSchedule(settings).catch((error) => logDevError('applyReminderSchedule (init)', error));
    },

    refreshTasks: () => {
      // Reuses each task's previous object reference where its visible
      // data hasn't changed -- listByDay() always builds fresh objects
      // from SQLite rows, and handing those straight to
      // React.memo(TaskRow) would defeat it (a "new" reference is a
      // "changed" prop by React's default shallow comparison, even with
      // identical contents).
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
  };
});
