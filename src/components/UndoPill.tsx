import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout } from '@/theme';

type Props = { onUndo: () => void };

/** Spec 3.2 / 4: dark pill, white 15pt text "Done · Undo", above the FAB and safe area. */
export function UndoPill({ onUndo }: Props) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.pill}>
        <Text style={styles.text}>Done · </Text>
        <Pressable onPress={onUndo} hitSlop={8}>
          <Text style={[styles.text, styles.undo]}>Undo</Text>
        </Pressable>
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
});
