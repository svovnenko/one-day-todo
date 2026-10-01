/**
 * All date/time logic lives here as pure functions of `now: Date` (and
 * settings), unit tested in __tests__/dates.test.ts.
 *
 * Never use `toISOString()` for day keys -- it returns UTC. Day keys use
 * local getFullYear/getMonth/getDate, and day arithmetic uses local setDate().
 */

export type DayKey = string; // 'YYYY-MM-DD'

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function dateKey(d: Date): DayKey {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHHMM(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatHHMM(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Adds `days` calendar days (local, DST-safe). */
export function addDays(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** The logical date of `now` (time-of-day irrelevant) -- the previous calendar date if before day-end time E. */
export function logicalDate(now: Date, dayEndTime: string): Date {
  if (minutesOfDay(now) < parseHHMM(dayEndTime)) {
    return addDays(now, -1);
  }
  return new Date(now);
}

export function todayKey(now: Date, dayEndTime: string): DayKey {
  return dateKey(logicalDate(now, dayEndTime));
}

export function tomorrowKey(now: Date, dayEndTime: string): DayKey {
  return dateKey(addDays(logicalDate(now, dayEndTime), 1));
}

/** Minutes into the logical day from E, wrapping at 1440 -- takes raw minutes-of-day so it's reusable for `now` or any HH:mm setting. */
export function offsetMinutes(minutesOfDayValue: number, dayEndTime: string): number {
  return (((minutesOfDayValue - parseHHMM(dayEndTime)) % 1440) + 1440) % 1440;
}

export function offset(now: Date, dayEndTime: string): number {
  return offsetMinutes(minutesOfDay(now), dayEndTime);
}

/** True from P until E (which may cross midnight); the default view is then "Tomorrow". */
export function isPlanningMode(now: Date, planningTime: string, dayEndTime: string): boolean {
  return offset(now, dayEndTime) >= offsetMinutes(parseHHMM(planningTime), dayEndTime);
}

/** Milliseconds from `now` until the next occurrence of local time `hhmm` (today or tomorrow). */
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

/** Parses a day key back into a local Date at midnight. */
export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The only allowed day-end times (spec 3.1 v4): whole hours from midnight to 04:00, so the day never switches before midnight. */
export const ALLOWED_DAY_END_TIMES = ['00:00', '01:00', '02:00', '03:00', '04:00'] as const;

export function isValidDayEnd(dayEndTime: string): boolean {
  return (ALLOWED_DAY_END_TIMES as readonly string[]).includes(dayEndTime);
}

/** Planning time must fall in the afternoon/evening of the same calendar day (spec 3.1 v4): 12:00-23:59. */
export function isValidPlanningTime(planningTime: string): boolean {
  const minutes = parseHHMM(planningTime);
  return minutes >= 12 * 60 && minutes <= 23 * 60 + 59;
}
