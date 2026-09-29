import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, layout } from '@/theme';

type Props = { onPress: () => void };

/** Spec 3.3 / 4: 56pt white circle, bottom-left, soft shadow, black "+" 24pt. */
export function AddFab({ onPress }: Props) {
  return (
    <Pressable style={styles.fab} onPress={onPress} hitSlop={8} accessibilityLabel="Add task">
      <Text style={styles.plus}>+</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    left: 16,
    bottom: 16,
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
  plus: { fontSize: 24, color: colors.text, lineHeight: 26 },
});
