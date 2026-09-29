import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Task } from '@/db/tasksRepo';
import { buildCarryOverCandidates, CarryOverCandidate, defaultCheckedIds } from '@/logic/carryOver';
import { freeSlots } from '@/logic/limits';
import { colors, layout } from '@/theme';

type Props = {
  visible: boolean;
  tasks: Task[];
  tomorrowTasks: Task[];
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
export function CarryOverSheet({ visible, tasks, tomorrowTasks, onMove, onSkip }: Props) {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const translateY = useRef(new Animated.Value(SHEET_OFFSCREEN_OFFSET)).current;

  const candidates = buildCarryOverCandidates(tasks, tomorrowTasks);
  const free = freeSlots(tomorrowTasks.length);

  // Initializes the checkboxes only on the hidden -> visible transition
  // (intentionally depends only on `visible`, not `tasks`/`tomorrowTasks` --
  // app/index.tsx rebuilds those arrays on every render, and re-initializing
  // on every one of those would snap a checkbox the user just toggled back
  // while the sheet is still open).
  useEffect(() => {
    if (visible) {
      setChecked(() => {
        const ids = defaultCheckedIds(candidates, free);
        const initial: Record<string, boolean> = {};
        for (const id of ids) initial[id] = true;
        return initial;
      });
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

  // How many of tomorrow's free slots the current checks would consume --
  // a deduplicating task merges into an existing tomorrow task instead of
  // taking a new slot, so it's excluded (spec 3.4 v5).
  const usedSlots = candidates.filter((c) => checked[c.task.id] && !c.blocked && !c.deduplicates).length;

  function toggle(candidate: CarryOverCandidate) {
    if (candidate.blocked) return;
    const id = candidate.task.id;
    setChecked((prev) => {
      const willCheck = !prev[id];
      if (willCheck && !candidate.deduplicates) {
        const currentlyUsed = candidates.filter((c) => prev[c.task.id] && !c.blocked && !c.deduplicates).length;
        if (currentlyUsed >= free) return prev; // no free slots left -- can't check another
      }
      return { ...prev, [id]: willCheck };
    });
  }

  function handleMove() {
    onMove(candidates.filter((c) => checked[c.task.id]).map((c) => c.task.id));
  }

  const tomorrowNote = free === 0 ? 'Tomorrow is full' : `Tomorrow: ${free} free`;

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} />
      <Animated.View style={{ transform: [{ translateY }] }}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.title}>Move unfinished to tomorrow?</Text>
          <Text style={styles.tomorrowNote}>{tomorrowNote}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {candidates.map(({ task, blocked, deduplicates }) => {
              const isChecked = !!checked[task.id];
              const disabledUnchecked = !blocked && !deduplicates && !isChecked && usedSlots >= free;
              return (
                <Pressable
                  key={task.id}
                  style={styles.row}
                  onPress={() => toggle({ task, blocked, deduplicates })}
                  disabled={blocked}
                >
                  <View
                    style={[
                      styles.checkbox,
                      isChecked && styles.checkboxChecked,
                      (blocked || disabledUnchecked) && styles.checkboxDisabled,
                    ]}
                  >
                    {isChecked ? <Text style={styles.checkmark}>✓</Text> : null}
                  </View>
                  <View style={styles.rowTextColumn}>
                    <Text style={[styles.rowText, blocked && styles.rowTextBlocked]} numberOfLines={1}>
                      {task.text}
                      {task.carryCount >= 1 ? <Text style={styles.counter}>{'  ×' + task.carryCount}</Text> : null}
                    </Text>
                    {blocked ? <Text style={styles.blockedNote}>can&rsquo;t move again</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable style={[styles.moveButton, free === 0 && styles.moveButtonDisabled]} onPress={handleMove} disabled={free === 0}>
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
  title: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
  tomorrowNote: { fontSize: 13, color: colors.muted, marginBottom: 12 },
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
  checkboxDisabled: { borderColor: colors.faint },
  checkmark: { color: colors.background, fontSize: 13, fontWeight: '700' },
  rowTextColumn: { flex: 1 },
  rowText: { fontSize: 17, color: colors.text },
  rowTextBlocked: { color: colors.faint },
  blockedNote: { fontSize: 13, color: colors.faint },
  counter: { fontSize: 13, color: colors.faint },
  moveButton: {
    backgroundColor: colors.text,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  moveButtonDisabled: { backgroundColor: colors.faint },
  moveButtonText: { color: colors.background, fontSize: 17, fontWeight: '600' },
  skipButton: { alignItems: 'center', paddingVertical: 16 },
  skipButtonText: { color: colors.muted, fontSize: 15 },
});
