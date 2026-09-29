import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { moveTasks, shouldShowCarryPrompt } from '@/logic/carryOver';
import { applyReminderSchedule } from '@/logic/notifications';
import { planRollover } from '@/logic/rollover';
import { resolveView } from '@/logic/viewLock';

export type View = 'today' | 'tomorrow';
export type Mode = 'day' | 'planning';

/** Exported so the Undo pill's shrinking-line animation can't disagree with the store's actual timeout (spec 3.2). */
export const UNDO_WINDOW_MS = 3000;

/**
 * A task the user just completed (swiped right) or emptied out (edited to
 * blank text). It stays in SQLite untouched until the window commits, so
 * killing the app mid-window loses nothing (spec section 5) -- only the UI
 * hides it and shows the Undo pill. `timeoutId` auto-commits after
 * UNDO_WINDOW_MS.
 */
type PendingUndo = {
  task: tasksRepo.Task;
  timeoutId: ReturnType<typeof setTimeout>;
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
  pendingUndo: PendingUndo | null;
  /** Whether the "Move unfinished to tomorrow?" bottom sheet is showing (spec 3.4). */
  carrySheetVisible: boolean;
  /**
   * True when evaluateCarryPrompt's conditions are met but the sheet
   * hasn't been revealed yet. Kept separate from carrySheetVisible so the
   * store never presents the sheet itself -- the main screen decides WHEN
   * to reveal it (only while focused and the app is active), which is
   * what fixed the freeze in TASK_FIXES_03 (an RN Modal shown while a
   * native screen transition / AppState transition is in flight could get
   * stuck as an invisible layer swallowing all touches on iOS).
   */
  carryPromptDue: boolean;

  /** Opens the DB, loads settings + today/tomorrow's tasks, and picks the default view. */
  init: () => void;
  /** Re-reads today/tomorrow's tasks from SQLite into state. */
  refreshTasks: () => void;
  /** In day mode, a 'tomorrow' target is redirected to today -- Tomorrow doesn't exist yet (spec 3.1). */
  addTask: (view: View, text: string) => void;
  /** Saving empty text completes (deletes-with-undo) the task instead (spec 3.2). */
  editTask: (id: string, text: string) => void;
  /** Swipe-right completion: opens (or replaces) the Undo window (UNDO_WINDOW_MS). */
  completeTask: (task: tasksRepo.Task) => void;
  /** Cancels the pending deletion; the task simply stays where it was. */
  undoPending: () => void;
  /** Permanently deletes whatever is pending (called on timeout or explicitly). */
  commitPendingUndo: () => void;
  /** Ignored for 'tomorrow' while in day mode -- Tomorrow can't be selected before planning time (spec 3.1). */
  setSelectedView: (view: View) => void;
  /**
   * Day-end rollover (spec 3.5): commits any pending undo first, deletes
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
  updateSchedule: (partial: Partial<Pick<settingsRepo.Settings, 'planningTime' | 'dayEndTime' | 'reminderEnabled'>>) => void;
};

/** Trims, collapses to a single line, and caps length per spec 3.2 (1-200 chars). */
function sanitizeTaskText(raw: string): string {
  return raw.replace(/\r?\n/g, ' ').trim().slice(0, 200);
}

export const useAppStore = create<AppState>((set, get) => ({
  isReady: false,
  settings: settingsRepo.DEFAULT_SETTINGS,
  todayDay: '',
  tomorrowDay: '',
  mode: 'day',
  todayTasks: [],
  tomorrowTasks: [],
  selectedView: 'today',
  pendingUndo: null,
  carrySheetVisible: false,
  carryPromptDue: false,

  init: () => {
    const settings = settingsRepo.getSettings();
    set({ settings });
    get().runRollover();
    set({ isReady: true });
    applyReminderSchedule(settings).catch(() => {});
  },

  refreshTasks: () => {
    const { todayDay, tomorrowDay } = get();
    set({
      todayTasks: tasksRepo.listByDay(todayDay),
      tomorrowTasks: tasksRepo.listByDay(tomorrowDay),
    });
  },

  addTask: (view, text) => {
    const trimmed = sanitizeTaskText(text);
    if (!trimmed) return;
    const { todayDay, tomorrowDay, mode } = get();
    const effectiveView = resolveView(view, mode);
    tasksRepo.add(effectiveView === 'today' ? todayDay : tomorrowDay, trimmed);
    get().refreshTasks();
  },

  editTask: (id, text) => {
    const trimmed = sanitizeTaskText(text);
    if (!trimmed) {
      const task =
        get().todayTasks.find((t) => t.id === id) ?? get().tomorrowTasks.find((t) => t.id === id);
      if (task) get().completeTask(task);
      return;
    }
    tasksRepo.updateText(id, trimmed);
    get().refreshTasks();
  },

  completeTask: (task) => {
    // Only one pending undo at a time -- completing another task commits
    // (permanently deletes) whatever was already pending.
    get().commitPendingUndo();
    const timeoutId = setTimeout(() => get().commitPendingUndo(), UNDO_WINDOW_MS);
    set({ pendingUndo: { task, timeoutId } });
  },

  undoPending: () => {
    const { pendingUndo } = get();
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timeoutId);
    set({ pendingUndo: null });
  },

  commitPendingUndo: () => {
    const { pendingUndo } = get();
    if (!pendingUndo) return;
    clearTimeout(pendingUndo.timeoutId);
    tasksRepo.remove(pendingUndo.task.id);
    set({ pendingUndo: null });
    get().refreshTasks();
  },

  setSelectedView: (view) => set({ selectedView: resolveView(view, get().mode) }),

  runRollover: () => {
    get().commitPendingUndo(); // spec 3.5: commit a pending completion before purging
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
    const { settings, todayDay, todayTasks } = get();
    const now = new Date();
    const due = shouldShowCarryPrompt(now, settings, todayDay, settings.lastCarryPromptDate, todayTasks.length);
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
    applyReminderSchedule(settings).catch(() => {});
  },
}));
