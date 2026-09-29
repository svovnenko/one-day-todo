import { create } from 'zustand';

import * as settingsRepo from '@/db/settingsRepo';
import * as tasksRepo from '@/db/tasksRepo';
import { isPlanningMode, todayKey, tomorrowKey } from '@/logic/dates';

export type View = 'today' | 'tomorrow';

type AppState = {
  isReady: boolean;
  settings: settingsRepo.Settings;
  /** Logical-date keys ('YYYY-MM-DD') for the two lists currently shown. */
  todayDay: string;
  tomorrowDay: string;
  todayTasks: tasksRepo.Task[];
  tomorrowTasks: tasksRepo.Task[];
  selectedView: View;

  /** Opens the DB, loads settings + today/tomorrow's tasks, and picks the default view. */
  init: () => void;
  /** Re-reads today/tomorrow's tasks from SQLite into state. */
  refreshTasks: () => void;
  addTask: (view: View, text: string) => void;
  /** Saving empty text deletes the task instead (per spec 3.2). */
  editTask: (id: string, text: string) => void;
  deleteTask: (id: string) => void;
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
      tasksRepo.remove(id);
    } else {
      tasksRepo.updateText(id, trimmed);
    }
    get().refreshTasks();
  },

  deleteTask: (id) => {
    tasksRepo.remove(id);
    get().refreshTasks();
  },

  setSelectedView: (view) => set({ selectedView: view }),
}));
