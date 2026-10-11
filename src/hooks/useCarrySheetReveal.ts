import { useIsFocused } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

/**
 * evaluateCarryPrompt / the rollover only mark a sheet as due -- this hook
 * decides when to actually reveal it, only once focused AND active
 * (showing it mid-transition could leave an invisible layer swallowing
 * touches on iOS). Covers both sheets: the store shows the catch-up sheet
 * first, and `sheetUp` flipping back to false when it closes is what lets
 * the evening sheet follow. Re-checks on focus/AppState changes.
 */
export function useCarrySheetReveal(): void {
  const due = useAppStore((s) => s.carryPromptDue || s.catchUpDue);
  const sheetUp = useAppStore((s) => s.carrySheetVisible || s.catchUpSheetVisible);
  const showCarrySheetIfDue = useAppStore((s) => s.showCarrySheetIfDue);
  const isFocused = useIsFocused();

  useEffect(() => {
    function tryReveal() {
      if (due && !sheetUp && isFocused && AppState.currentState === 'active') {
        showCarrySheetIfDue();
      }
    }
    tryReveal();
    const subscription = AppState.addEventListener('change', tryReveal);
    return () => subscription.remove();
  }, [due, sheetUp, isFocused, showCarrySheetIfDue]);
}
