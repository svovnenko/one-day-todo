import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { moveTasks, shouldShowCarryPrompt } from '@/logic/carryOver';
import { planRollover } from '@/logic/rollover';

export type View = 'today' | 'tomorrow';

const UNDO_WINDOW_MS = 4000;

/**
 * A task the user just completed (swiped right) or emptied out (edited to
 * blank text). It stays in SQLite untouched until the window commits, so
 * killing the app mid-window loses nothing (spec section 5) -- only the UI
 * hides it and shows the Undo pill. `timeoutId` auto-commits after 4s.
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
  /** Whether we're currently in day mode or planning mode (spec 3.1); independent of selectedView, which the user can override manually. */
  mode: 'day' | 'planning';
  todayTasks: tasksRepo.Task[];
  tomorrowTasks: tasksRepo.Task[];
  selectedView: View;
  pendingUndo: PendingUndo | null;
  /** Whether the "Move unfinished to tomorrow?" bottom sheet is showing (spec 3.4). */
  carrySheetVisible: boolean;

  /** Opens the DB, loads settings + today/tomorrow's tasks, and picks the default view. */
  init: () => void;
  /** Re-reads today/tomorrow's tasks from SQLite into state. */
  refreshTasks: () => void;
  addTask: (view: View, text: string) => void;
  /** Saving empty text completes (deletes-with-undo) the task instead (spec 3.2). */
  editTask: (id: string, text: string) => void;
  /** Swipe-right completion: opens (or replaces) the 4s Undo window. */
  completeTask: (task: tasksRepo.Task) => void;
  /** Cancels the pending deletion; the task simply stays where it was. */
  undoPending: () => void;
  /** Permanently deletes whatever is pending (called on timeout or explicitly). */
  commitPendingUndo: () => void;
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
  /** Sets carrySheetVisible if the spec 3.4 conditions are currently met. Called after runRollover/refreshMode. */
  evaluateCarryPrompt: () => void;
  /** Fallback link (spec 3.4): reopens the sheet even if already shown today. */
  openCarrySheet: () => void;
  /** "Skip": marks the prompt as shown for today and closes the sheet. */
  skipCarrySheet: () => void;
  /** "Move": moves the checked tasks to tomorrow, marks the prompt shown, and closes the sheet. */
  moveCarryOverTasks: (taskIds: string[]) => void;
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

  init: () => {
    const settings = settingsRepo.getSettings();
    set({ settings });
    get().runRollover();
    set({ isReady: true });
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
    const { todayDay, tomorrowDay } = get();
    tasksRepo.add(view === 'today' ? todayDay : tomorrowDay, trimmed);
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

  setSelectedView: (view) => set({ selectedView: view }),

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
    const show = shouldShowCarryPrompt(now, settings, todayDay, settings.lastCarryPromptDate, todayTasks.length);
    if (show) set({ carrySheetVisible: true });
  },

  openCarrySheet: () => set({ carrySheetVisible: true }),

  skipCarrySheet: () => {
    const { todayDay, settings } = get();
    settingsRepo.setLastCarryPromptDate(todayDay);
    set({ settings: { ...settings, lastCarryPromptDate: todayDay }, carrySheetVisible: false });
  },

  moveCarryOverTasks: (taskIds) => {
    const { todayDay, tomorrowDay, settings } = get();
    moveTasks(taskIds, todayDay, tomorrowDay);
    settingsRepo.setLastCarryPromptDate(todayDay);
    set({ settings: { ...settings, lastCarryPromptDate: todayDay }, carrySheetVisible: false });
    get().refreshTasks();
  },
}));
