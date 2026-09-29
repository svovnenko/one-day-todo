import * as Crypto from 'expo-crypto';

import { getDb } from './database';

export type Task = {
  id: string;
  text: string;
  day: string; // 'YYYY-MM-DD' logical date
  position: number;
  carryCount: number;
  createdAt: number; // epoch ms
};

type TaskRow = {
  id: string;
  text: string;
  day: string;
  position: number;
  carry_count: number;
  created_at: number;
};

function fromRow(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    day: row.day,
    position: row.position,
    carryCount: row.carry_count,
    createdAt: row.created_at,
  };
}

function nextPosition(day: string): number {
  const row = getDb().getFirstSync<{ maxPos: number | null }>(
    'SELECT MAX(position) as maxPos FROM tasks WHERE day = ?',
    day
  );
  return (row?.maxPos ?? 0) + 1;
}

/** All tasks for a logical day, in list order. */
export function listByDay(day: string): Task[] {
  const rows = getDb().getAllSync<TaskRow>('SELECT * FROM tasks WHERE day = ? ORDER BY position ASC', day);
  return rows.map(fromRow);
}

/** Appends a new task to the bottom of `day`'s list. */
export function add(day: string, text: string): Task {
  const id = Crypto.randomUUID();
  const position = nextPosition(day);
  const createdAt = Date.now();
  getDb().runSync(
    'INSERT INTO tasks (id, text, day, position, carry_count, created_at) VALUES (?, ?, ?, ?, 0, ?)',
    id,
    text,
    day,
    position,
    createdAt
  );
  return { id, text, day, position, carryCount: 0, createdAt };
}

export function updateText(id: string, text: string): void {
  getDb().runSync('UPDATE tasks SET text = ? WHERE id = ?', text, id);
}

export function remove(id: string): void {
  getDb().runSync('DELETE FROM tasks WHERE id = ?', id);
}

/**
 * Re-inserts a task exactly as it was. The normal Undo flow never deletes a
 * task from SQLite while its 4-second undo window is open (the row is only
 * hidden in memory, so the app being killed mid-window is a safe failure —
 * see spec section 5) and calls `remove()` once the window commits. This is
 * a safety net for callers that do delete optimistically.
 */
export function restore(task: Task): void {
  getDb().runSync(
    'INSERT OR REPLACE INTO tasks (id, text, day, position, carry_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    task.id,
    task.text,
    task.day,
    task.position,
    task.carryCount,
    task.createdAt
  );
}

export function findByDayAndText(day: string, text: string): Task | null {
  const row = getDb().getFirstSync<TaskRow>('SELECT * FROM tasks WHERE day = ? AND text = ? LIMIT 1', day, text);
  return row ? fromRow(row) : null;
}

/** Relocates an existing task to the bottom of `day`'s list with a new carry count. */
export function moveToDay(id: string, day: string, carryCount: number): void {
  const position = nextPosition(day);
  getDb().runSync('UPDATE tasks SET day = ?, position = ?, carry_count = ? WHERE id = ?', day, position, carryCount, id);
}

export function setCarryCount(id: string, carryCount: number): void {
  getDb().runSync('UPDATE tasks SET carry_count = ? WHERE id = ?', carryCount, id);
}

/** Deletes every task whose day is strictly before `dayKey`. Returns the count removed. */
export function purgeBefore(dayKey: string): number {
  const result = getDb().runSync('DELETE FROM tasks WHERE day < ?', dayKey);
  return result.changes;
}

export type ImportedTask = {
  text: string;
  day: string;
  position: number;
  carryCount: number;
};

/** Deletes every task and inserts the given list, all in one transaction (backup import). */
export function replaceAll(tasks: ImportedTask[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM tasks');
    const now = Date.now();
    for (const t of tasks) {
      db.runSync(
        'INSERT INTO tasks (id, text, day, position, carry_count, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        Crypto.randomUUID(),
        t.text,
        t.day,
        t.position,
        t.carryCount,
        now
      );
    }
  });
}
