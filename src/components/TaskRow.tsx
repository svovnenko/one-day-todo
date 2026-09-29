import { StyleSheet, Text, View } from 'react-native';

import type { Task } from '@/db/tasksRepo';
import { colors, layout, type } from '@/theme';

type Props = { task: Task };

/**
 * Plain row per spec section 4: no separators, no checkboxes, no icons.
 * Swipe-to-complete and tap-to-edit are wired on top of this in milestone 4.
 */
export function TaskRow({ task }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.text} numberOfLines={1}>
        {task.text}
        {task.carryCount >= 1 ? <Text style={styles.counter}>{'  ×' + task.carryCount}</Text> : null}
      </Text>
    </View>
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
  counter: { fontSize: type.counter, color: colors.faint },
});
