import type { Appearance } from '@/logic/theme';

import { getDb } from './database';

export type Settings = {
  planningTime: string; // 'HH:mm', default '20:00'
  dayEndTime: string; // 'HH:mm', default '04:00'
  reminderEnabled: boolean;
  lastCarryPromptDate: string | null; // 'YYYY-MM-DD', null if never shown
  lastCompletedDate: string | null; // 'YYYY-MM-DD', null if never emptied Today by completing (spec 3.4/4 v6)
  appearance: Appearance; // 'system' | 'light' | 'dark', default 'system' (spec 3.6 v8)
};

export const DEFAULT_SETTINGS: Settings = {
  planningTime: '20:00',
  dayEndTime: '04:00',
  reminderEnabled: true,
  lastCarryPromptDate: null,
  lastCompletedDate: null,
  appearance: 'system',
};

const VALID_APPEARANCES: Appearance[] = ['system', 'light', 'dark'];

type StoredKey =
  'planningTime' | 'dayEndTime' | 'reminderEnabled' | 'lastCarryPromptDate' | 'lastCompletedDate' | 'appearance';

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
  const reminderEnabled = reminderEnabledRaw === null ? DEFAULT_SETTINGS.reminderEnabled : reminderEnabledRaw === '1';
  const lastCarryPromptDate = getRaw('lastCarryPromptDate');
  const lastCompletedDate = getRaw('lastCompletedDate');
  const appearanceRaw = getRaw('appearance');
  const appearance = VALID_APPEARANCES.includes(appearanceRaw as Appearance)
    ? (appearanceRaw as Appearance)
    : DEFAULT_SETTINGS.appearance;
  return { planningTime, dayEndTime, reminderEnabled, lastCarryPromptDate, lastCompletedDate, appearance };
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

export function setLastCompletedDate(dayKey: string): void {
  setRaw('lastCompletedDate', dayKey);
}

export function setAppearance(appearance: Appearance): void {
  setRaw('appearance', appearance);
}
