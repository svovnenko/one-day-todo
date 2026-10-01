import * as Haptics from 'expo-haptics';
import { memo, useMemo, useRef, useState } from 'react';
import { Animated, type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Task } from '@/db/tasksRepo';
import { useTheme } from '@/hooks/useTheme';
import { type Colors, layout, type } from '@/theme';

type Props = {
  task: Task;
  /** Fires at the swipe threshold (spec 3.2/4) -- the Undo window/button must start immediately, not after this row's own animation finishes. */
  onSwipeThreshold: (task: Task) => void;
  /** Fires once the completion animation has fully played out -- only then should the caller remove this row (earlier would cut it short). */
  onAnimationComplete: (task: Task) => void;
};

/** Row shows strike-through+grey briefly before collapsing, per spec 3.2. */
const STRIKE_DELAY_MS = 350;
const FADE_DURATION_MS = 150;
const COLLAPSE_DURATION_MS = 200;

/**
 * Swipe right to complete (reveals a light-grey background + checkmark).
 * No editing (spec 3.2 v4) -- a plain View, not Pressable, so a tap does nothing.
 *
 * Wrapped in React.memo: with a stable `task` reference
 * (src/logic/taskListDiff.ts) and stable callbacks (useCallback'd in
 * app/index.tsx), this only re-renders when its own data changes.
 */
export const TaskRow = memo(function TaskRow({ task, onSwipeThreshold, onAnimationComplete }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [isCompleting, setIsCompleting] = useState(false);
  // Only applied once the collapse animation starts -- until then the
  // row sizes itself naturally, giving a real measured height to collapse
  // FROM (without this, the row left a permanent height gap after fading).
  const [isCollapsing, setIsCollapsing] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const height = useRef(new Animated.Value(0)).current;
  const measuredHeightRef = useRef(layout.rowHeight);
  const swipeableRef = useRef<SwipeableMethods>(null);

  function handleLayout(event: LayoutChangeEvent) {
    // Guards against self-inflicted, ever-smaller onLayout readings once
    // collapsing starts (height is explicitly driven by the Animated.Value below).
    if (isCollapsing) return;
    measuredHeightRef.current = event.nativeEvent.layout.height;
  }

  function handleFullSwipe() {
    if (isCompleting) return;
    setIsCompleting(true);
    // The row stays open (never slides back closed) -- the fade below
    // hides everything together once the text has faded.
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); // best-effort, never user-visible
    // Starts the Undo window/button now, before the animation below even begins.
    onSwipeThreshold(task);
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => {
        // Locks in the row's last real height as the collapse's starting
        // point, so rows below slide up smoothly instead of snapping shut.
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
          // Only left actions exist (swipe right to complete), so any "open"
          // event means completed -- ReanimatedSwipeable reports RIGHT for
          // a rightward drag opening the left panel, not LEFT.
          onSwipeableOpen={() => handleFullSwipe()}
        >
          <View style={styles.row}>
            <Text style={[styles.text, isCompleting && styles.textCompleting]}>
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

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      minHeight: layout.rowHeight,
      justifyContent: 'center',
      paddingHorizontal: layout.screenPadding,
      paddingVertical: 6,
      backgroundColor: colors.background,
    },
    // lineHeight 26 + 6pt padding = layout.rowHeight (38) for one line --
    // matches the pre-wrap look; extra lines just grow the row.
    text: { fontSize: type.task, lineHeight: 26, color: colors.text },
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
}
