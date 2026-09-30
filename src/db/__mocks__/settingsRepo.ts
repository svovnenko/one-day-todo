// Manual Jest mock for src/db/settingsRepo.ts -- see src/db/__mocks__/tasksRepo.ts.
import type { Settings } from '../settingsRepo';

export const DEFAULT_SETTINGS: Settings = {
  planningTime: '20:00',
  dayEndTime: '04:00',
  reminderEnabled: true,
  lastCarryPromptDate: null,
  lastCompletedDate: null,
  appearance: 'system',
};

let settings: Settings = { ...DEFAULT_SETTINGS };

export function getSettings(): Settings {
  return { ...settings };
}

export function setPlanningTime(hhmm: string): void {
  settings.planningTime = hhmm;
}

export function setDayEndTime(hhmm: string): void {
  settings.dayEndTime = hhmm;
}

export function setReminderEnabled(enabled: boolean): void {
  settings.reminderEnabled = enabled;
}

export function setLastCarryPromptDate(dayKey: string): void {
  settings.lastCarryPromptDate = dayKey;
}

export function setLastCompletedDate(dayKey: string): void {
  settings.lastCompletedDate = dayKey;
}

export function setAppearance(appearance: Settings['appearance']): void {
  settings.appearance = appearance;
}

/** Test-only: resets settings to the defaults, optionally overridden. */
export function __reset(overrides: Partial<Settings> = {}): void {
  settings = { ...DEFAULT_SETTINGS, ...overrides };
}
