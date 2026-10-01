/** Design tokens from section 4 of the spec. */
export type Colors = {
  background: string;
  text: string;
  muted: string;
  faint: string;
  /** Swipe-to-complete reveal background, and the settings day-end segmented control's track. */
  swipeBackground: string;
  /** FAB/input bar/sheet background -- lighter than `background` so dark mode's true-black screen still shows depth. */
  surface: string;
  border: string;
  /** Carry-over sheet's backdrop, behind the sheet itself. */
  backdrop: string;
  /** Undo button background -- dark in light mode, inverted (light) in dark mode. */
  pill: string;
  pillText: string;
  pillRing: string;
  /** Opacity for the FAB/Undo button's drop shadow -- 0 in dark mode (spec v8: "the FAB has no shadow"). */
  shadowOpacity: number;
  /** Disabled `Move` button background (spec v8.1) -- a dedicated token, not a dimmer `faint`, so it reads as clearly inert. */
  disabledBackground: string;
};

export const lightColors: Colors = {
  background: '#FFFFFF',
  text: '#000000',
  muted: '#8E8E93',
  faint: '#B3B3B3',
  swipeBackground: '#F2F2F7',
  surface: '#FFFFFF',
  border: '#E5E5EA',
  backdrop: 'rgba(0,0,0,0.3)',
  pill: '#1C1C1E',
  pillText: '#FFFFFF',
  pillRing: '#FFFFFF',
  shadowOpacity: 0.15,
  disabledBackground: '#E5E5EA',
};

/** Spec 4 v8: true-black dark palette. */
export const darkColors: Colors = {
  background: '#000000',
  text: '#FFFFFF',
  muted: '#8E8E93',
  faint: '#5A5A5E',
  swipeBackground: '#1C1C1E',
  surface: '#1C1C1E',
  border: '#38383A',
  backdrop: 'rgba(0,0,0,0.6)',
  pill: '#F2F2F7',
  pillText: '#000000',
  pillRing: '#000000',
  shadowOpacity: 0,
  disabledBackground: '#2C2C2E',
};

export const layout = {
  rowHeight: 38,
  screenPadding: 16,
  listTopGap: 24,
  fabSize: 56,
};

export const type = {
  task: 20,
  header: 15,
  counter: 13,
  input: 17,
  empty: 17,
};
