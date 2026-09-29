import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import Reanimated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { UNDO_WINDOW_MS } from '@/store/useAppStore';
import { colors } from '@/theme';

export type UndoBatchInfo = {
  /** Bumped every time a task joins the batch -- how this component tells "a new swipe happened" apart from an unrelated re-render, without keying off any single task's id. */
  version: number;
  /** Batch size; a count shows under "Undo" once this reaches 2 (spec 3.2 v4: batch undo). */
  count: number;
};

type Props = {
  /** Null when nothing is pending. Drives this component's own mount/reset/fade-out lifecycle (see comment below). */
  batch: UndoBatchInfo | null;
  onUndo: () => void;
};

const SIZE = 96;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const EXIT_FADE_MS = 200;
const BOTTOM_OFFSET = 80;

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

/**
 * Spec 3.2 / 4: round 96pt Undo button, bottom center, its bottom edge
 * raised 80pt above the safe area (center about 130pt up, above the +
 * FAB) -- dark background, only the white "Undo" text, no icon. A white
 * 4pt ring empties clockwise from 12 o'clock over UNDO_WINDOW_MS. When
 * the batch has 2+ tasks, a small count shows under "Undo".
 *
 * This component manages its own show/reset/fade-out purely from `batch`
 * (rather than being mounted with a `key`, which would unmount-and-remount
 * on ANY change, including batch -> null, skipping the "fades out when
 * the time is up" exit animation -- spec 4). Instead: null -> non-null
 * shows it and starts the ring; non-null -> non-null with a DIFFERENT
 * `version` (another task joined the batch) resets the ring instantly, no
 * fade; non-null -> null fades the whole button out before unmounting.
 */
export function UndoButton({ batch, onUndo }: Props) {
  const [mounted, setMounted] = useState(batch !== null);
  const opacity = useRef(new Animated.Value(batch !== null ? 1 : 0)).current;
  const progress = useSharedValue(0);
  const previousVersion = useRef<number | null>(null);

  useEffect(() => {
    if (batch) {
      // Appears immediately, and restarts instantly if it was already
      // showing (another task just joined the batch).
      setMounted(true);
      opacity.stopAnimation();
      opacity.setValue(1);
      progress.value = 0;
      progress.value = withTiming(1, { duration: UNDO_WINDOW_MS, easing: Easing.linear });
      previousVersion.current = batch.version;
    } else if (previousVersion.current !== null) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: EXIT_FADE_MS,
        useNativeDriver: true,
      }).start(() => setMounted(false));
      previousVersion.current = null;
    }
  }, [batch, opacity, progress]);

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
        {batch && batch.count >= 2 ? <Text style={styles.count}>{batch.count}</Text> : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: BOTTOM_OFFSET,
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
  text: { color: colors.pillText, fontSize: 22, fontWeight: '600' },
  count: { color: colors.pillText, fontSize: 13, opacity: 0.7 },
});
