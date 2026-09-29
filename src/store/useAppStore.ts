import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { isPlanningMode, todayKey, tomorrowKey } from '@/logic/dates';

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
  todayTasks: tasksRepo.Task[];
  tomorrowTasks: tasksRepo.Task[];
  selectedView: View;
  pendingUndo: PendingUndo | null;

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
  todayTasks: [],
  tomorrowTasks: [],
  selectedView: 'today',
  pendingUndo: null,

  init: () => {
    const settings = settingsRepo.getSettings();
    const now = new Date();
    const todayDay = todayKey(now, settings.dayEndTime);
    const tomorrowDay = tomorrowKey(now, settings.dayEndTime);
    const selectedView: View = isPlanningMode(now, settings.planningTime, settings.dayEndTime)
      ? 'tomorrow'
      : 'today';

    set({
      isReady: true,
      settings,
      todayDay,
      tomorrowDay,
      todayTasks: tasksRepo.listByDay(todayDay),
      tomorrowTasks: tasksRepo.listByDay(tomorrowDay),
      selectedView,
    });
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
}));
