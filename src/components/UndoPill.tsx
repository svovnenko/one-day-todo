import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { UNDO_WINDOW_MS } from '@/store/useAppStore';
import { colors, layout } from '@/theme';

type Props = { onUndo: () => void };

/**
 * Spec 3.2 / 4: dark pill, white 15pt text "Done · Undo", above the FAB
 * and safe area. A thin line along the bottom shrinks from full width to
 * zero over UNDO_WINDOW_MS, so the pill and the store's actual timeout
 * can't disagree. Give this component a `key` of the pending task's id
 * where it's rendered, so the animation restarts fresh whenever a new
 * task replaces the pending undo.
 */
export function UndoPill({ onUndo }: Props) {
  const scaleX = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(scaleX, {
      toValue: 0,
      duration: UNDO_WINDOW_MS,
      useNativeDriver: true,
    }).start();
  }, [scaleX]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Text style={styles.text}>Done · </Text>
        <Pressable onPress={onUndo} hitSlop={8}>
          <Text style={[styles.text, styles.undo]}>Undo</Text>
        </Pressable>
        <Animated.View pointerEvents="none" style={[styles.timerLine, { transform: [{ scaleX }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: layout.fabSize + 32,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    height: layout.undoPillHeight,
    paddingHorizontal: 20,
    borderRadius: layout.undoPillHeight / 2,
    backgroundColor: colors.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 15, color: colors.pillText },
  undo: { fontWeight: '600' },
  timerLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 6,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
    transformOrigin: 'left',
  },
});
