import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

const SLIDE_DURATION_MS = 220;
const SHEET_OFFSCREEN_OFFSET = 320;

/**
 * Spec 3.4 / 4: white bottom sheet, rounded top, checkbox list, black
 * Move / grey text Skip.
 *
 * Deliberately NOT a React Native <Modal> (see TASK_FIXES_03): presenting
 * a native Modal while another native transition is in flight -- the
 * Settings screen (a native-stack `presentation: 'modal'`) dismissing, or
 * an AppState change around a notification tap -- could leave an
 * invisible modal layer on iOS that swallows every touch and freezes the
 * app. This is a plain absolutely positioned View instead, rendered last
 * in app/index.tsx so it stacks visually on top; there is no native
 * presentation for iOS to get stuck mid-transition.
 */
export function CarryOverSheet({ visible, tasks, onMove, onSkip }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN_OFFSET)).current;

  // Initializes the checkboxes only on the hidden -> visible transition
  // (intentionally depends only on `visible`, not `tasks` -- app/index.tsx
  // rebuilds that array on every render, and re-initializing on every one
  // of those would snap a checkbox the user just toggled back while the
  // sheet is still open).
  useEffect(() => {
    if (visible) {
      const initial: Record<string, boolean> = {};
      for (const task of tasks) initial[task.id] = defaultChecked(task);
      setChecked(initial);
      translateY.setValue(SHEET_OFFSCREEN_OFFSET);
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional, see comment above
  }, [visible]);

  if (!visible) return null;

  function toggle(id: string) {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function handleMove() {
    onMove(tasks.filter((task) => checked[task.id]).map((task) => task.id));
  }

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} />
      <Animated.View style={{ transform: [{ translateY }] }}>
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
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
