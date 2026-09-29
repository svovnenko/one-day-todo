/**
 * All date/time logic for the app lives here as pure functions of `now: Date`
 * (and settings), so it can be unit tested (see __tests__/dates.test.ts).
 *
 * IMPORTANT: never use `toISOString()` for day keys — it returns UTC. Day keys
 * are built from local `getFullYear`/`getMonth`/`getDate`, and day arithmetic
 * uses local `setDate()` so DST transitions are handled correctly by the
 * platform's Date implementation.
 */

export type DayKey = string; // 'YYYY-MM-DD'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Local calendar date key 'YYYY-MM-DD' for a given Date, ignoring time-of-day. */
export function dateKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Minutes since local midnight, e.g. 14:05 -> 845. */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** Parses 'HH:mm' into minutes since midnight. */
export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Formats minutes since midnight back into 'HH:mm'. */
export function formatHHMM(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Returns a new Date with `days` calendar days added (local, DST-safe). */
export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * The logical date of `now`, as a Date (time-of-day is irrelevant; use
 * dateKey() on the result). If the local time is before the day-end time E,
 * the logical date is the previous calendar date.
 */
export function logicalDate(now: Date, dayEndTime: string): Date {
  if (minutesOfDay(now) < parseHHMM(dayEndTime)) {
    return addDays(now, -1);
  }
  return new Date(now);
}

/** Logical-date key for "today". */
export function todayKey(now: Date, dayEndTime: string): DayKey {
  return dateKey(logicalDate(now, dayEndTime));
}

/** Logical-date key for "tomorrow" (today + 1 calendar day). */
export function tomorrowKey(now: Date, dayEndTime: string): DayKey {
  return dateKey(addDays(logicalDate(now, dayEndTime), 1));
}

/**
 * offset(t) = minutes into the logical day, counting from E, wrapping at 1440.
 * Takes a plain minutes-of-day value so it can be reused for both `now` and a
 * setting like the planning time.
 */
export function offsetMinutes(minutesOfDayValue: number, dayEndTime: string): number {
  return (((minutesOfDayValue - parseHHMM(dayEndTime)) % 1440) + 1440) % 1440;
}

/** offset(now), per spec 3.1. */
export function offset(now: Date, dayEndTime: string): number {
  return offsetMinutes(minutesOfDay(now), dayEndTime);
}

/**
 * True from the planning time P until the day-end time E (which may cross
 * midnight); the default view is then "Tomorrow".
 */
export function isPlanningMode(now: Date, planningTime: string, dayEndTime: string): boolean {
  return offset(now, dayEndTime) >= offsetMinutes(parseHHMM(planningTime), dayEndTime);
}

/**
 * Milliseconds from `now` until the next occurrence of local time `hhmm`
 * (today if it hasn't passed yet, otherwise tomorrow).
 */
export function msUntilNext(now: Date, hhmm: string): number {
  const minutes = parseHHMM(hhmm);
  const target = new Date(now);
  target.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - now.getTime();
}

const headerFormatter = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

/** Formats a logical date for the header, e.g. "Tue 29 Sep". */
export function formatHeaderDate(d: Date): string {
  return headerFormatter.format(d);
}

/** Parses a 'YYYY-MM-DD' day key back into a local Date at midnight. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
