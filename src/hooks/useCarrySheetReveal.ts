import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

/**
 * evaluateCarryPrompt only marks `carryPromptDue` -- this hook decides
 * when to actually reveal the sheet, only once focused AND active
 * (showing it mid-transition could leave an invisible layer swallowing
 * touches on iOS). Re-checks on focus/AppState changes.
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
