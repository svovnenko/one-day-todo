import * as SQLite from 'expo-sqlite';

const DB_NAME = 'one-day-todo.db';
const SCHEMA_VERSION = 1;

let db: SQLite.SQLiteDatabase | null = null;

function migrate(database: SQLite.SQLiteDatabase) {
  const row = database.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;

  if (version < 1) {
    database.execSync(`
      CREATE TABLE IF NOT EXISTS tasks (
        id           TEXT PRIMARY KEY,
        text         TEXT NOT NULL,
        day          TEXT NOT NULL,
        position     INTEGER NOT NULL,
        carry_count  INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day, position);

      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  if (version < SCHEMA_VERSION) {
    database.execSync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
}

/** Opens (once) and returns the app's SQLite database, running migrations. */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    db.execSync('PRAGMA journal_mode = WAL');
    migrate(db);
  }
  return db;
}

/** Test-only: closes and forgets the cached connection so a fresh one opens. */
export function resetDbForTests(): void {
  if (db) {
    db.closeSync();
    db = null;
  }
}
