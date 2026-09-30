import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';

import { isListFull } from '@/logic/limits';
import { useAppStore } from '@/store/useAppStore';

/**
 * Owns the input bar's open/closed state and every path that can add a
 * task (Return, and the keyboard hiding with a non-empty draft), per
 * spec 3.2/3.3: discard-and-warn when the target list is already full
 * (or just reached the limit on this very add -- the store's own return
 * value is a safety net for the second case), otherwise flag the next
 * auto-scroll and keep the bar open unless that add was the one that hit
 * the limit.
 *
 * `flagScrollToEnd` is injected (from `useAutoScroll`) rather than
 * imported directly, so this hook doesn't need to know the list has
 * auto-scroll at all -- just that something wants to know after a
 * successful add.
 */
export function useInputSession(flagScrollToEnd: () => void) {
  const [inputVisible, setInputVisible] = useState(false);
  const selectedView = useAppStore((s) => s.selectedView);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const addTask = useAppStore((s) => s.addTask);

  const isCurrentListFull = isListFull(selectedView === 'today' ? todayTasks.length : tomorrowTasks.length);

  const attemptAdd = useCallback(
    (text: string): boolean => {
      const view = useAppStore.getState().selectedView;
      const countBefore =
        view === 'today' ? useAppStore.getState().todayTasks.length : useAppStore.getState().tomorrowTasks.length;
      if (isListFull(countBefore)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); // best-effort, never user-visible
        return false;
      }
      if (!addTask(view, text)) {
        // safety net -- the store refused despite the pre-check above
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); // best-effort, never user-visible
        return false;
      }
      flagScrollToEnd();
      const countAfter =
        view === 'today' ? useAppStore.getState().todayTasks.length : useAppStore.getState().tomorrowTasks.length;
      return !isListFull(countAfter);
    },
    [addTask, flagScrollToEnd]
  );

  /** Return, from InputBar: add, and close the bar if that just filled the list. */
  const handleAdd = useCallback(
    (text: string) => {
      if (!attemptAdd(text)) {
        Keyboard.dismiss();
        setInputVisible(false);
      }
    },
    [attemptAdd]
  );

  /** InputBar's keyboard hid: save a non-empty draft (unless the list is full), then close. */
  const handleInputClose = useCallback(
    (text: string) => {
      if (text.trim().length > 0) attemptAdd(text);
      Keyboard.dismiss(); // formality -- it's normally already hidden, since that's what triggered this
      setInputVisible(false);
    },
    [attemptAdd]
  );

  // AddFab itself handles a tap while full (haptic + shake, no callback) -- this only ever fires when the list has room.
  const handleFabPress = useCallback(() => setInputVisible(true), []);

  return { inputVisible, isCurrentListFull, handleAdd, handleInputClose, handleFabPress };
}
