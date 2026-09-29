// Deliberately duplicates useAppStore's View/Mode string-literal unions
// instead of importing them, so this stays a leaf module with no
// dependency on the store (same reasoning as viewLock.ts).
type View = 'today' | 'tomorrow';
type Mode = 'day' | 'planning';

export type FooterLine = {
  text: string;
  /** Only the "Move unfinished to tomorrow ›" line is tappable (spec 3.2/3.4 v7). */
  tappable: boolean;
  /** 'full' is styled 17pt (spec 3.2 v7); 'carryOver' keeps the fallback link's existing size. */
  kind: 'full' | 'carryOver';
};

const FULL_LINE = 'Full — finish a task to add more';
const MOVE_LINE = 'Move unfinished to tomorrow ›';

/**
 * Up to two lines at the end of the task list (spec 3.2/3.4 v7), in order:
 * 1. "Full -- finish a task to add more" when the VIEWED list is full,
 *    regardless of view or mode.
 * 2. The carry-over line -- only in the Today view, only in planning mode,
 *    and only when Today has at least one movable task:
 *    - Tomorrow has room: the tappable "Move unfinished to tomorrow ›" link.
 *    - Tomorrow is full and line 1 is also showing: "Tomorrow is full too".
 *    - Tomorrow is full and line 1 isn't showing: "Tomorrow is full".
 */
export function footerLines(args: {
  view: View;
  mode: Mode;
  viewedFull: boolean;
  tomorrowFull: boolean;
  hasMovable: boolean;
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
  return lines;
}
