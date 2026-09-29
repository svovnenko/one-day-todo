import { getDb } from './database';

export type Settings = {
  planningTime: string; // 'HH:mm', default '20:00'
  dayEndTime: string; // 'HH:mm', default '04:00'
  reminderEnabled: boolean;
  lastCarryPromptDate: string | null; // 'YYYY-MM-DD', null if never shown
};

export const DEFAULT_SETTINGS: Settings = {
  planningTime: '20:00',
  dayEndTime: '04:00',
  reminderEnabled: true,
  lastCarryPromptDate: null,
};

type StoredKey = 'planningTime' | 'dayEndTime' | 'reminderEnabled' | 'lastCarryPromptDate';

function getRaw(key: StoredKey): string | null {
  const row = getDb().getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  return row?.value ?? null;
}

function setRaw(key: StoredKey, value: string): void {
  getDb().runSync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

/** Reads all settings, falling back to defaults for anything not yet stored. */
export function getSettings(): Settings {
  const planningTime = getRaw('planningTime') ?? DEFAULT_SETTINGS.planningTime;
  const dayEndTime = getRaw('dayEndTime') ?? DEFAULT_SETTINGS.dayEndTime;
  const reminderEnabledRaw = getRaw('reminderEnabled');
  const reminderEnabled =
    reminderEnabledRaw === null ? DEFAULT_SETTINGS.reminderEnabled : reminderEnabledRaw === '1';
  const lastCarryPromptDate = getRaw('lastCarryPromptDate');
  return { planningTime, dayEndTime, reminderEnabled, lastCarryPromptDate };
}

export function setPlanningTime(hhmm: string): void {
  setRaw('planningTime', hhmm);
}

export function setDayEndTime(hhmm: string): void {
  setRaw('dayEndTime', hhmm);
}

export function setReminderEnabled(enabled: boolean): void {
  setRaw('reminderEnabled', enabled ? '1' : '0');
}

export function setLastCarryPromptDate(dayKey: string): void {
  setRaw('lastCarryPromptDate', dayKey);
}

/** Overwrites schedule + reminder settings in one go (used by backup import). */
export function replaceScheduleSettings(settings: {
  planningTime: string;
  dayEndTime: string;
  reminderEnabled: boolean;
}): void {
  setRaw('planningTime', settings.planningTime);
  setRaw('dayEndTime', settings.dayEndTime);
  setRaw('reminderEnabled', settings.reminderEnabled ? '1' : '0');
}
