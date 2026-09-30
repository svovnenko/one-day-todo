import * as Haptics from 'expo-haptics';
import { memo, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Task } from '@/db/tasksRepo';
import { colors, layout, type } from '@/theme';

type Props = {
  task: Task;
  /**
   * Fires the instant the swipe crosses the threshold (spec 3.2/4): the
   * caller should start the Undo window right away (the Undo button
   * must appear immediately, not ~500ms later once this row's own
   * animation finishes).
   */
  onSwipeThreshold: (task: Task) => void;
  /**
   * Fires once this row's entire completion animation (strike-through,
   * fade, height collapse) has fully played out. The caller should only
   * now actually remove the row from whatever list it renders --
   * removing it earlier would cut the animation short and/or leave a gap.
   */
  onAnimationComplete: (task: Task) => void;
};

/** Row shows strike-through+grey briefly before collapsing, per spec 3.2. */
const STRIKE_DELAY_MS = 350;
const FADE_DURATION_MS = 150;
const COLLAPSE_DURATION_MS = 200;

/**
 * Swipe right to complete (full swipe, revealing a light-grey background
 * with a checkmark). No editing (spec 3.2 v4): a tap does nothing -- no
 * handler, no highlight, no feedback of any kind. A plain View, not a
 * Pressable, so there's nothing for a tap to trigger.
 *
 * Wrapped in React.memo: with the caller passing a stable
 * `task` object reference (see src/logic/taskListDiff.ts) and stable
 * `onSwipeThreshold`/`onAnimationComplete` callbacks (both useCallback'd
 * with empty dependency arrays in app/index.tsx), this only re-renders
 * when THIS row's own data actually changes, not on every keystroke in
 * the input bar or every other row's swipe/completion.
 */
export const TaskRow = memo(function TaskRow({ task, onSwipeThreshold, onAnimationComplete }: Props) {
  const [isCompleting, setIsCompleting] = useState(false);
  // Only applied once the collapse animation actually starts (see
  // `isCollapsing`) -- until then the row sizes itself naturally (via
  // styles.row's minHeight), so there's a real measured height to collapse
  // FROM once completion begins. Without this, removing the row from the
  // list left a permanent row-height gap -- the row's own Animated.View
  // had faded to opacity 0, but opacity never affects layout, so it kept
  // reserving its full height until (if ever) it actually left the
  // rendered list.
  const [isCollapsing, setIsCollapsing] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(0)).current;
  const measuredHeightRef = useRef(layout.rowHeight);
  const swipeableRef = useRef<SwipeableMethods>(null);

  function handleLayout(event: LayoutChangeEvent) {
    measuredHeightRef.current = event.nativeEvent.layout.height;
  }

  function handleFullSwipe() {
    if (isCompleting) return;
    setIsCompleting(true);
    // The row stays exactly where the swipe left it (open, revealing the
    // grey/checkmark zone) -- it must never slide back closed. Only the
    // fade below hides it, and it fades everything (row + revealed zone)
    // together, so nothing is left showing once the text has faded.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); // best-effort, never user-visible
    // Start the Undo window/button right now, before the animation below
    // even begins -- this is purely cosmetic and mustn't delay it.
    onSwipeThreshold(task);
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        // Lock in the row's last real (natural) height as the animation's
        // starting point, then shrink it to 0 so the rows below slide up
        // smoothly instead of the list snapping shut the instant this row
        // actually leaves the data array.
        height.setValue(measuredHeightRef.current);
        setIsCollapsing(true);
        Animated.timing(height, {
          toValue: 0,
          duration: COLLAPSE_DURATION_MS,
          useNativeDriver: false, // height isn't supported by the native driver
        }).start(() => onAnimationComplete(task));
      });
    }, STRIKE_DELAY_MS);
  }

  return (
    <Animated.View onLayout={handleLayout} style={isCollapsing ? { height, overflow: 'hidden' } : undefined}>
      <Animated.View style={{ opacity }}>
        <Swipeable
          ref={swipeableRef}
          testID={`task-swipeable-${task.id}`}
          friction={2}
          leftThreshold={80}
          dragOffsetFromLeftEdge={5}
          overshootLeft={false}
          enabled={!isCompleting}
          renderLeftActions={() => (
            <View style={styles.actionBackground}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
          // Only left actions exist (spec: swipe right to complete), so any
          // "open" event -- regardless of the reported direction -- means the
          // task completed. (ReanimatedSwipeable reports SwipeDirection.RIGHT
          // for a rightward drag that opens the left action panel, not LEFT.)
          onSwipeableOpen={() => handleFullSwipe()}
        >
          <View style={styles.row}>
            <Text style={[styles.text, isCompleting && styles.textCompleting]} numberOfLines={1}>
              {task.text}
              {task.carryCount >= 1 ? (
                <Text style={[styles.counter, isCompleting && styles.textCompleting]}>{'  ×' + task.carryCount}</Text>
              ) : null}
            </Text>
          </View>
        </Swipeable>
      </Animated.View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: layout.rowHeight,
    justifyContent: 'center',
    paddingHorizontal: layout.screenPadding,
    backgroundColor: colors.background,
  },
  text: { fontSize: type.task, color: colors.text },
  textCompleting: { color: colors.faint, textDecorationLine: 'line-through' },
  counter: { fontSize: type.counter, color: colors.faint },
  actionBackground: {
    flex: 1,
    backgroundColor: colors.swipeBackground,
    justifyContent: 'center',
    paddingLeft: layout.screenPadding,
  },
  checkmark: { fontSize: 18, color: colors.muted },
});
