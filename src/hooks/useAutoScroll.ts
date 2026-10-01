import { useCallback, useRef } from 'react';
import type { FlatList, LayoutChangeEvent } from 'react-native';

/**
 * Scrolls to reveal a newly added row (spec 3.3), only when it isn't
 * already visible above the input bar/keyboard. `listAreaHeightRef`
 * tracks the list container's own (keyboard-shrunk) height via onLayout.
 */
export function useAutoScroll<T>(listRef: React.RefObject<FlatList<T> | null>) {
  const scrollToNewPendingRef = useRef(false);
  const listAreaHeightRef = useRef(0);

  const handleListAreaLayout = useCallback((e: LayoutChangeEvent) => {
    listAreaHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const handleContentSizeChange = useCallback(
    (_width: number, height: number) => {
      if (!scrollToNewPendingRef.current) return;
      scrollToNewPendingRef.current = false;
      if (height > listAreaHeightRef.current) {
        listRef.current?.scrollToEnd({ animated: true });
      }
    },
    [listRef]
  );

  /** Call right after a task is actually added, so the next content-size change scrolls to reveal it. */
  const flagScrollToEnd = useCallback(() => {
    scrollToNewPendingRef.current = true;
  }, []);

  return { handleListAreaLayout, handleContentSizeChange, flagScrollToEnd };
}
