import { useCallback, useRef } from 'react';
import type { FlatList, LayoutChangeEvent } from 'react-native';

/**
 * Scrolls the list to reveal a newly added row (spec 3.3), but only when
 * it isn't already fully visible above the input bar/keyboard.
 * `listAreaHeightRef` tracks the list container's OWN layout height (via
 * `onLayout`), which already shrinks when KeyboardAvoidingView makes room
 * for the keyboard -- so "is the content taller than what's visible"
 * naturally accounts for the keyboard/input bar with no extra logic.
 * Adding to a list that already fits on screen moves nothing.
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
