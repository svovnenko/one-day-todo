import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export const BACKUP_APP_ID = 'one-day-todo';
export const BACKUP_VERSION = 1;

export type BackupTask = {
  text: string;
  day: string; // 'YYYY-MM-DD'
  position: number;
  carryCount: number;
};

export type BackupSettings = {
  planningTime: string;
  dayEndTime: string;
  reminderEnabled: boolean;
};

export type BackupFile = {
  app: string;
  version: number;
  exportedAt: string;
  settings: BackupSettings;
  tasks: BackupTask[];
};

/** Spec 3.8: the export JSON shape. */
export function buildExport(now: Date, settings: BackupSettings, tasks: BackupTask[]): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings,
    tasks,
  };
}

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTime(v: unknown): v is string {
  return typeof v === 'string' && HHMM_RE.test(v);
}

function isValidTask(v: unknown): v is BackupTask {
  if (typeof v !== 'object' || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.text === 'string' &&
    t.text.length >= 1 &&
    t.text.length <= 200 &&
    typeof t.day === 'string' &&
    DAY_KEY_RE.test(t.day) &&
    typeof t.position === 'number' &&
    Number.isFinite(t.position) &&
    typeof t.carryCount === 'number' &&
    Number.isFinite(t.carryCount)
  );
}

/**
 * Validates an arbitrary parsed JSON value as a backup file (spec 3.8:
 * checks `app`/`version`, field types, and text length). Returns the
 * validated, narrowly-typed backup, or null if anything doesn't match --
 * the caller shows "This file is not a valid backup." and changes nothing.
 */
export function validateBackup(json: unknown): BackupFile | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;

  if (obj.app !== BACKUP_APP_ID) return null;
  if (obj.version !== BACKUP_VERSION) return null;

  const settingsRaw = obj.settings;
  if (typeof settingsRaw !== 'object' || settingsRaw === null) return null;
  const s = settingsRaw as Record<string, unknown>;
  if (!isValidTime(s.planningTime) || !isValidTime(s.dayEndTime)) return null;
  if (typeof s.reminderEnabled !== 'boolean') return null;
  if (s.planningTime === s.dayEndTime) return null;

  if (!Array.isArray(obj.tasks) || !obj.tasks.every(isValidTask)) return null;

  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date(0).toISOString(),
    settings: { planningTime: s.planningTime, dayEndTime: s.dayEndTime, reminderEnabled: s.reminderEnabled },
    tasks: obj.tasks as BackupTask[],
  };
}

/** Writes the backup JSON to a cache file and opens the iOS/Android share sheet. */
export async function exportBackupFile(payload: BackupFile, todayDayKey: string): Promise<void> {
  const file = new File(Paths.cache, `one-day-todo-${todayDayKey}.json`);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json' });
}

/**
 * Opens the document picker for a JSON file and returns its parsed
 * contents, or null if the user cancelled. Throws if the file can't be
 * read or isn't valid JSON -- the caller treats that the same as an
 * invalid backup.
 */
export async function pickBackupJson(): Promise<unknown | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/json' });
  if (result.canceled || !result.assets[0]) return null;
  const file = new File(result.assets[0].uri);
  const text = await file.text();
  return JSON.parse(text);
}
