// Deliberately duplicates useAppStore's View/Mode string-literal unions
// instead of importing them, so this stays a leaf module with no
// dependency on the store (same reasoning as viewLock.ts).
type View = 'today' | 'tomorrow';
type Mode = 'day' | 'planning';

export type FooterLine = {
  text: string;
  /** Only the "Move unfinished to tomorrow ›" and "N left from last time ›" lines are tappable (spec 3.2/3.4 v7, 3.5 v9). */
  tappable: boolean;
  /** 'full' is styled 17pt (spec 3.2 v7); 'carryOver' keeps the fallback link's existing size; 'catchUp' reopens the catch-up sheet (spec 3.5 v9). */
  kind: 'full' | 'carryOver' | 'catchUp';
};

const FULL_LINE = 'Full — finish a task to add more';
const MOVE_LINE = 'Move unfinished to tomorrow ›';

/**
 * Up to three lines at the end of the list (spec 3.2/3.4 v7), in order:
 * 1. "Full -- finish a task to add more" when the VIEWED list is full.
 * 2. The carry-over line -- only in Today/planning mode with a movable
 *    task: the tappable move link if Tomorrow has room, else "Tomorrow
 *    is full" (or "...full too" if line 1 is also showing).
 * 3. Spec 3.5 v9: "N left from last time ›" (tappable) while catch-up tasks
 *    wait -- Today view, any mode, always last.
 */
export function footerLines(args: {
  view: View;
  mode: Mode;
  viewedFull: boolean;
  tomorrowFull: boolean;
  hasMovable: boolean;
  catchUpCount?: number;
}): FooterLine[] {
  const lines: FooterLine[] = [];
  if (args.viewedFull) {
    lines.push({ text: FULL_LINE, tappable: false, kind: 'full' });
  }
  if (args.view === 'today' && args.mode === 'planning' && args.hasMovable) {
    if (!args.tomorrowFull) {
      lines.push({ text: MOVE_LINE, tappable: true, kind: 'carryOver' });
    } else if (args.viewedFull) {
      lines.push({ text: 'Tomorrow is full too', tappable: false, kind: 'carryOver' });
    } else {
      lines.push({ text: 'Tomorrow is full', tappable: false, kind: 'carryOver' });
    }
  }
  if (args.view === 'today' && (args.catchUpCount ?? 0) > 0) {
    lines.push({ text: `${args.catchUpCount} left from last time ›`, tappable: true, kind: 'catchUp' });
  }
  return lines;
}
