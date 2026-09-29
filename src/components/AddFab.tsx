import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, layout, type } from '@/theme';

type Props = {
  onPress: () => void;
  /** Spec 3.2 v5: the viewed list is at OPEN_TASK_LIMIT -- FAB dims but stays tappable. */
  isFull?: boolean;
  /** Shows the "10 tasks max" note above the FAB for a couple of seconds (owned by the caller). */
  showMessage?: boolean;
};

/** Spec 3.3 / 4: 56pt white circle, bottom-left, soft shadow, black "+" 24pt. */
export function AddFab({ onPress, isFull = false, showMessage = false }: Props) {
  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      {showMessage && (
        <View style={styles.message} pointerEvents="none">
          <Text style={styles.messageText}>10 tasks max. Finish one first.</Text>
        </View>
      )}
      <Pressable
        style={[styles.fab, isFull && styles.fabFull]}
        onPress={onPress}
        hitSlop={8}
        accessibilityLabel="Add task"
      >
        <Text style={styles.plus}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    bottom: 16,
    alignItems: 'flex-start',
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
  message: {
    position: 'absolute',
    bottom: layout.fabSize + 12,
    left: 0,
    backgroundColor: colors.swipeBackground,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 220,
  },
  messageText: { fontSize: type.counter, color: colors.muted },
});
