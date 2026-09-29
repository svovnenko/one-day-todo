// Deliberately duplicates useAppStore's View/Mode string-literal unions
// instead of importing them, so this stays a leaf module with no
// dependency on the store (which pulls in expo-sqlite and can't be
// imported directly under Jest -- see __tests__/viewLock.test.ts).
type View = 'today' | 'tomorrow';
type Mode = 'day' | 'planning';

/**
 * Tomorrow is locked in day mode (spec 3.1): a request for 'tomorrow'
 * while in day mode resolves to 'today' instead. Used to guard both
 * setSelectedView (a manual tap -- the Tomorrow label isn't even rendered
 * then, but the store still enforces it) and addTask (so a task's text is
 * never silently dropped, e.g. if the input bar was open on Tomorrow when
 * the mode flipped from planning to day).
 */
export function resolveView(requestedView: View, mode: Mode): View {
  return requestedView === 'tomorrow' && mode === 'day' ? 'today' : requestedView;
}
