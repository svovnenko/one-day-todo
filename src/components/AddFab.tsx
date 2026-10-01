import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { type Colors, layout } from '@/theme';

type Props = {
  /** Called only when the FAB is tapped while NOT full -- opens the input bar. */
  onPress: () => void;
  /** Spec 3.2 v7: the viewed list is at OPEN_TASK_LIMIT -- FAB dims but stays tappable. */
  isFull?: boolean;
};

const SHAKE_STEPS = [8, -8, 6, -6, 0];
const SHAKE_STEP_DURATION_MS = 60; // 5 steps * 60ms = ~300ms total, per spec 3.2 v7

/**
 * Spec 3.3/4: 56pt circle, bottom-left, soft shadow (none in dark mode
 * -- spec v8), "+" 24pt.
 *
 * Spec 3.2 v7: tapping while full is a warning haptic + short shake,
 * nothing else -- the "list is full" footer line (src/logic/footer.ts)
 * tells the user why.
 */
export function AddFab({ onPress, isFull = false }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  // One-time value (only ever mutated via setValue/timing) -- safe to read during render, unlike a ref.
  const [translateX] = useState(() => new Animated.Value(0));

  function handlePress() {
    if (isFull) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {}); // best-effort, never user-visible
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

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 16,
      bottom: 16,
    },
    fab: {
      width: layout.fabSize,
      height: layout.fabSize,
      borderRadius: layout.fabSize / 2,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: colors.shadowOpacity,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: colors.shadowOpacity > 0 ? 4 : 0,
    },
    fabFull: { opacity: 0.4 },
    plus: { fontSize: 24, color: colors.text, lineHeight: 26 },
  });
}
