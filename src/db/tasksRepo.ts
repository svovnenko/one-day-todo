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

export function remove(id: string): void {
  getDb().runSync('DELETE FROM tasks WHERE id = ?', id);
}

/** Deletes several tasks in one transaction (spec 3.2 v4: committing a batch-undo timeout/rollover). */
export function removeMany(ids: string[]): void {
  if (ids.length === 0) return;
  const db = getDb();
  db.withTransactionSync(() => {
    for (const id of ids) {
      db.runSync('DELETE FROM tasks WHERE id = ?', id);
    }
  });
}

export function findByDayAndText(day: string, text: string): Task | null {
  const row = getDb().getFirstSync<TaskRow>('SELECT * FROM tasks WHERE day = ? AND text = ? LIMIT 1', day, text);
  return row ? fromRow(row) : null;
}

/** Relocates an existing task to the bottom of `day`'s list with a new carry count. */
export function moveToDay(id: string, day: string, carryCount: number): void {
  const position = nextPosition(day);
  getDb().runSync(
    'UPDATE tasks SET day = ?, position = ?, carry_count = ? WHERE id = ?',
    day,
    position,
    carryCount,
    id
  );
}

export function setCarryCount(id: string, carryCount: number): void {
  getDb().runSync('UPDATE tasks SET carry_count = ? WHERE id = ?', carryCount, id);
}

/** Deletes every task whose day is strictly before `dayKey`. Returns the count removed. */
export function purgeBefore(dayKey: string): number {
  const result = getDb().runSync('DELETE FROM tasks WHERE day < ?', dayKey);
  return result.changes;
}
