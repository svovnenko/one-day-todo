import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

/**
 * `evaluateCarryPrompt` (run from the store's runRollover/refreshMode)
 * only marks `carryPromptDue` -- it never shows the sheet itself, even if
 * that happens while Settings is open or an AppState transition is in
 * flight. This hook is the one place that decides to actually reveal it,
 * and only once it's both focused (e.g. back from Settings) and the app
 * is active -- showing an RN Modal-adjacent sheet mid-transition can
 * otherwise leave an invisible layer swallowing every touch on iOS.
 * Re-checks whenever `carryPromptDue` or focus changes, and again on
 * every AppState transition (covers "backgrounded, tap the notification").
 */
export function useCarrySheetReveal(): void {
  const carryPromptDue = useAppStore((s) => s.carryPromptDue);
  const showCarrySheetIfDue = useAppStore((s) => s.showCarrySheetIfDue);
  const isFocused = useIsFocused();

  useEffect(() => {
    function tryReveal() {
      if (carryPromptDue && isFocused && AppState.currentState === 'active') {
        showCarrySheetIfDue();
      }
    }
    tryReveal();
    const subscription = AppState.addEventListener('change', tryReveal);
    return () => subscription.remove();
  }, [carryPromptDue, isFocused, showCarrySheetIfDue]);
}
