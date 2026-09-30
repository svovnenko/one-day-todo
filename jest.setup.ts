// Global Jest setup for RNTL interaction tests (spec section 7 acceptance
// scenarios exercised at the screen level). Runs once per test file,
// before that file's own imports resolve.

// Reanimated's own bundled `/mock` still imports its real index (and so
// the real native react-native-worklets runtime) internally in this
// version, which throws under Jest with no native module registered --
// so instead of that official mock, this is a small hand-written stand-in
// covering the one thing this codebase actually uses reanimated for
// (UndoButton's countdown ring): a shared-value object, a no-op easing,
// a synchronous animatedProps factory call, and createAnimatedComponent
// as the identity function (SVG's AnimatedCircle just renders as Circle).
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { createAnimatedComponent: (Component: unknown) => Component },
  Easing: { linear: (t: number) => t },
  useSharedValue: (initial: number) => ({ value: initial }),
  useAnimatedProps: (factory: () => Record<string, unknown>) => factory(),
  withTiming: (toValue: number) => toValue,
}));

// Gesture-handler's own recommended jest setup (mocks its native module and
// a couple of RN components it wraps).
require('react-native-gesture-handler/jestSetup');

// ReanimatedSwipeable itself (not just gesture-handler's native module)
// leans on a much larger slice of reanimated (useAnimatedRef, measure,
// runOnUI, withSpring, ...) purely to drive its drag animation -- none of
// which these tests exercise or care about. Replaced with a plain View
// that renders its children and exposes `onSwipeableOpen` as a normal
// prop, so a test can trigger "swipe completed" the same way the task's
// own suggestion does: `fireEvent(getByTestId(...), 'swipeableOpen')`
// (TaskRow sets `testID` to `task-swipeable-${task.id}`).
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { forwardRef, useImperativeHandle, createElement } = require('react');
  const { View } = require('react-native');
  const MockSwipeable = forwardRef(
    (props: { testID?: string; onSwipeableOpen?: () => void; children?: unknown }, ref: unknown) => {
      useImperativeHandle(ref, () => ({ close: () => {}, openLeft: () => {}, openRight: () => {}, reset: () => {} }));
      return createElement(View, { testID: props.testID, onSwipeableOpen: props.onSwipeableOpen }, props.children);
    }
  );
  return { __esModule: true, default: MockSwipeable };
});

// expo-haptics/expo-notifications/expo-splash-screen all talk to native
// modules that don't exist under Jest -- replaced with no-op promises so
// components that call them (TaskRow, AddFab, app/_layout.tsx) render and
// behave the same as on a device, just silently.
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ granted: true })),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve()),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(() => Promise.resolve()),
  hideAsync: jest.fn(() => Promise.resolve()),
}));

// RN's real Keyboard module wraps a native event emitter that doesn't
// exist under Jest, so `Keyboard.addListener('keyboardDidHide', ...)`
// (InputBar) never actually fires. Rather than spread the whole
// react-native namespace (most of its exports are lazy getters --
// spreading forces every one of them to resolve immediately, including
// native modules that don't exist under Jest at all, like DevMenu), this
// mutates the real Keyboard singleton's own addListener/dismiss in
// place. dismiss() fires 'keyboardDidHide' just like it does on a real
// device (dismissing the keyboard is what triggers that event), so a
// test can simulate "the keyboard hid" the same way `app/index.tsx`'s
// own Keyboard.dismiss() calls do, by calling it directly.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  const listeners: Record<string, Array<() => void>> = {};
  RN.Keyboard.addListener = (eventType: string, callback: () => void) => {
    (listeners[eventType] ??= []).push(callback);
    return {
      remove: () => {
        listeners[eventType] = (listeners[eventType] ?? []).filter((l) => l !== callback);
      },
    };
  };
  RN.Keyboard.dismiss = () => {
    for (const callback of listeners.keyboardDidHide ?? []) callback();
  };
  return RN;
});

// The real repos ultimately hit expo-sqlite, which doesn't exist under
// Jest either. Replaced with the in-memory fakes in src/db/__mocks__/,
// which implement the same repo API -- so useAppStore's real logic runs
// unmodified against an in-memory "database" (reset per test via
// __tests__/testUtils/fakeRepos.ts).
jest.mock('@/db/tasksRepo');
jest.mock('@/db/settingsRepo');
