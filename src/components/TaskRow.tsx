import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

import type { Task } from '@/db/tasksRepo';
import { colors, layout, type } from '@/theme';

type Props = {
  task: Task;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
};

/** Row shows strike-through+grey briefly before collapsing, per spec 3.2. */
const STRIKE_DELAY_MS = 350;
const FADE_DURATION_MS = 150;

/**
 * Swipe right to complete (full swipe, revealing a light-grey background
 * with a checkmark); tap to edit. A tap never completes, preventing
 * accidental deletions.
 */
export function TaskRow({ task, onComplete, onEdit }: Props) {
  const [isCompleting, setIsCompleting] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<SwipeableMethods>(null);

  function handleFullSwipe() {
    if (isCompleting) return;
    setIsCompleting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start(() => onComplete(task));
    }, STRIKE_DELAY_MS);
  }

  return (
    <Swipeable
      ref={swipeableRef}
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
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.LEFT) {
          handleFullSwipe();
        }
      }}>
      <Animated.View style={{ opacity }}>
        <Pressable style={styles.row} onPress={() => !isCompleting && onEdit(task)}>
          <Text style={[styles.text, isCompleting && styles.textCompleting]} numberOfLines={1}>
            {task.text}
            {task.carryCount >= 1 ? (
              <Text style={[styles.counter, isCompleting && styles.textCompleting]}>
                {'  ×' + task.carryCount}
              </Text>
            ) : null}
          </Text>
        </Pressable>
      </Animated.View>
    </Swipeable>
  );
}

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
