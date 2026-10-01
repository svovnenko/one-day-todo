import * as Haptics from 'expo-haptics';
import { useCallback, useState } from 'react';
import { Keyboard } from 'react-native';

import { isListFull } from '@/logic/limits';
import { useAppStore } from '@/store/useAppStore';

/**
 * Owns the input bar's open/closed state and every add path (Return,
 * keyboard-hide-with-draft): discard-and-warn when full (spec 3.2/3.3),
 * otherwise flag auto-scroll. `flagScrollToEnd` is injected so this
 * hook doesn't need to know about auto-scroll itself.
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
