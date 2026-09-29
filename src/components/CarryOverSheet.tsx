import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Task } from '@/db/tasksRepo';
import { defaultChecked } from '@/logic/carryOver';
import { colors, layout } from '@/theme';

type Props = {
  visible: boolean;
  tasks: Task[];
  onMove: (checkedIds: string[]) => void;
  onSkip: () => void;
};

/** Spec 3.4 / 4: white bottom sheet, rounded top, checkbox list, black Move / grey text Skip. */
export function CarryOverSheet({ visible, tasks, onMove, onSkip }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) {
      const initial: Record<string, boolean> = {};
      for (const task of tasks) initial[task.id] = defaultChecked(task);
      setChecked(initial);
    }
  }, [visible, tasks]);

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleMove() {
    onMove(tasks.filter((task) => checked[task.id]).map((task) => task.id));
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onSkip}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.title}>Move unfinished to tomorrow?</Text>
          <ScrollView style={styles.list} bounces={false}>
            {tasks.map((task) => (
              <Pressable key={task.id} style={styles.row} onPress={() => toggle(task.id)}>
                <View style={[styles.checkbox, checked[task.id] && styles.checkboxChecked]}>
                  {checked[task.id] ? <Text style={styles.checkmark}>✓</Text> : null}
                </View>
                <Text style={styles.rowText} numberOfLines={1}>
                  {task.text}
                  {task.carryCount >= 1 ? <Text style={styles.counter}>{'  ×' + task.carryCount}</Text> : null}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.moveButton} onPress={handleMove}>
            <Text style={styles.moveButtonText}>Move</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: layout.screenPadding,
    maxHeight: '70%',
  },
  title: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 12 },
  list: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.rowHeight,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.text, borderColor: colors.text },
  checkmark: { color: colors.background, fontSize: 13, fontWeight: '700' },
  rowText: { flex: 1, fontSize: 17, color: colors.text },
  counter: { fontSize: 13, color: colors.faint },
  moveButton: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  moveButtonText: { color: colors.background, fontSize: 17, fontWeight: '600' },
  skipButton: { alignItems: 'center', paddingVertical: 16 },
  skipButtonText: { color: colors.muted, fontSize: 15 },
});
