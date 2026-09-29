import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { UNDO_WINDOW_MS } from '@/store/useAppStore';
import { colors } from '@/theme';

type Props = {
  /** The pending task's id, or null when nothing is pending. Drives this component's own mount/reset/fade-out lifecycle (see comment below). */
  taskId: string | null;
  onUndo: () => void;
};

const SIZE = 64; // v4 (TASK_FIXES_05): bumped from 56pt; no longer tied to the + FAB's own size
const STROKE_WIDTH = 3;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EXIT_FADE_MS = 200;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/**
 * Spec 3.2 / 4: round 64pt Undo button, bottom center, level with the +
 * FAB (same bottom offset) -- dark background, only the white "Undo"
 * text, no icon. A white 3pt ring empties clockwise from 12 o'clock over
 * UNDO_WINDOW_MS.
 *
 * This component manages its own show/reset/fade-out purely from `taskId`
 * (rather than being mounted with a `key` of the task id): a `key` change
 * would unmount-and-remount on ANY change, including taskId -> null, which
 * would skip the "fades out when the time is up" exit animation (spec 4).
 * Instead: taskId null -> non-null shows it and starts the ring; non-null
 * -> a DIFFERENT non-null (a new task replaced the pending one) resets the
 * ring instantly, no fade; non-null -> null fades the whole button out
 * before unmounting.
 */
export function UndoButton({ taskId, onUndo }: Props) {
  const [mounted, setMounted] = useState(taskId !== null);
  const opacity = useRef(new Animated.Value(taskId !== null ? 1 : 0)).current;
  const progress = useSharedValue(0);
  const previousTaskId = useRef<string | null>(null);

  useEffect(() => {
    if (taskId) {
      // Appears immediately, and restarts instantly if it was already
      // showing for a different task (two quick completions in a row).
      setMounted(true);
      opacity.stopAnimation();
      opacity.setValue(1);
      progress.value = 0;
      progress.value = withTiming(1, { duration: UNDO_WINDOW_MS, easing: Easing.linear });
    } else if (previousTaskId.current) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_FADE_MS,
        useNativeDriver: true,
      }).start(() => setMounted(false));
    }
    previousTaskId.current = taskId;
  }, [taskId, opacity, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: progress.value * CIRCUMFERENCE,
  }));

  if (!mounted) return null;

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <Pressable style={styles.button} onPress={onUndo} accessibilityLabel="Undo">
        <Svg width={SIZE} height={SIZE} style={styles.ring} pointerEvents="none">
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            stroke="#FFFFFF"
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            animatedProps={animatedProps}
          />
        </Svg>
        <Text style={styles.text}>Undo</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 16, // same bottom offset as the + FAB
    alignItems: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.pill,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  // Rotated -90deg so the ring starts emptying from 12 o'clock (SVG's
  // stroke otherwise starts at 3 o'clock) and proceeds clockwise.
  ring: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  text: { color: colors.pillText, fontSize: 15, fontWeight: '600' },
});
