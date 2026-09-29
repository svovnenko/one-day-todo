import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, layout } from '@/theme';

type Props = {
  /** Called only when the FAB is tapped while NOT full -- opens the input bar. */
  onPress: () => void;
  /** Spec 3.2 v7: the viewed list is at OPEN_TASK_LIMIT -- FAB dims but stays tappable. */
  isFull?: boolean;
};

const SHAKE_STEPS = [8, -8, 6, -6, 0];
const SHAKE_STEP_DURATION_MS = 60; // 5 steps * 60ms = ~300ms total, per spec 3.2 v7

/**
 * Spec 3.3 / 4: 56pt white circle, bottom-left, soft shadow, black "+" 24pt.
 *
 * Spec 3.2 v7: tapping while full no longer opens a popup/toast -- instead
 * a warning haptic plus a short horizontal shake, and nothing else. The
 * "list is full" footer line (src/logic/footer.ts) is what actually tells
 * the user why, rendered by the list itself so it can never overlap
 * anything.
 */
export function AddFab({ onPress, isFull = false }: Props) {
  const translateX = useRef(new Animated.Value(0)).current;

  function handlePress() {
    if (isFull) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      translateX.setValue(0);
      Animated.sequence(
        SHAKE_STEPS.map((toValue) =>
          Animated.timing(translateX, {
            toValue,
            duration: SHAKE_STEP_DURATION_MS,
            useNativeDriver: true,
          })
        )
      ).start();
      return;
    }
    onPress();
  }

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ translateX }] }]}>
      <Pressable
        style={[styles.fab, isFull && styles.fabFull]}
        onPress={handlePress}
        hitSlop={8}
        accessibilityLabel="Add task"
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    bottom: 16,
  },
  fab: {
    width: layout.fabSize,
    height: layout.fabSize,
    borderRadius: layout.fabSize / 2,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  fabFull: { opacity: 0.4 },
  plus: { fontSize: 24, color: colors.text, lineHeight: 26 },
});
