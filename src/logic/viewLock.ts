// Duplicates useAppStore's View/Mode unions instead of importing them, so
// this stays a leaf module with no store/expo-sqlite dependency (see __tests__/viewLock.test.ts).
type View = 'today' | 'tomorrow';
type Mode = 'day' | 'planning';

/**
 * Tomorrow is locked in day mode (spec 3.1): resolves 'tomorrow' to
 * 'today'. Guards setSelectedView and addTask, so a task's text is
 * never silently dropped if the mode flips mid-session.
 */
export function resolveView(requestedView: View, mode: Mode): View {
  return requestedView === 'tomorrow' && mode === 'day' ? 'today' : requestedView;
}
