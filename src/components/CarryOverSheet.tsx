import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Task } from '@/db/tasksRepo';
import { useTheme } from '@/hooks/useTheme';
import { buildCarryOverCandidates, CarryOverCandidate } from '@/logic/carryOver';
import { freeSlots } from '@/logic/limits';
import { type Colors, layout } from '@/theme';

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
 * Spec 3.4 / 4 v7: white bottom sheet, rounded top, a plain text list --
 * no checkboxes or circles. Tapping a row selects it (black text, black
 * checkmark); a full-width black `Move N` and a grey `Let them go`.
 *
 * Deliberately NOT a React Native <Modal>: presenting a native Modal
 * while another native transition is in flight -- the
 * Settings screen (a native-stack `presentation: 'modal'`) dismissing, or
 * an AppState change around a notification tap -- could leave an
 * invisible modal layer on iOS that swallows every touch and freezes the
 * app. This is a plain absolutely positioned View instead, rendered last
 * in app/index.tsx so it stacks visually on top; there is no native
 * presentation for iOS to get stuck mid-transition.
 */
export function CarryOverSheet({ visible, tasks, tomorrowTasks, onMove, onSkip }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Lazy useState instead of useRef: only ever mutated through its own
  // methods (setValue/timing), never reassigned, so it's a one-time
  // value rather than a mutable ref cell -- safe to read during render.
  const [translateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_OFFSET));
  // Tracks the previous `visible` so the hidden -> visible transition can
  // be detected below, the same thing the old effect's `[visible]`
  // dependency array did.
  const [wasVisible, setWasVisible] = useState(visible);

  const candidates = buildCarryOverCandidates(tasks, tomorrowTasks);
  const free = freeSlots(tomorrowTasks.length);

  // Resets the selection to all-unselected the moment the sheet becomes
  // visible -- adjusted directly during render (rather than in an
  // effect) so the very first frame the sheet paints already shows the
  // reset selection, with no stale-then-corrected flash. Spec 3.4 v6:
  // moving a task to tomorrow must be a conscious choice, so nothing
  // starts pre-selected -- not even a carryCount-based nudge.
  //
  // Deliberately keyed only on `visible`, not on `tasks`/`tomorrowTasks`
  // -- app/index.tsx rebuilds those arrays on every render, and
  // re-initializing on every one of those would snap a row the user just
  // selected back while the sheet is still open.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setChecked({});
  }

  // The slide-in animation is a real side effect (an imperative
  // Animated.timing kickoff), so it stays in an effect rather than
  // joining the render-time adjustment above.
  useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_OFFSCREEN_OFFSET);
      Animated.timing(translateY, {
        toValue: 0,
        duration: SLIDE_DURATION_MS,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, translateY]);

  if (!visible) return null;

  // How many of tomorrow's free slots the current selection would consume
  // -- a deduplicating task merges into an existing tomorrow task instead
  // of taking a new slot, so it's excluded (spec 3.4 v5).
  const usedSlots = candidates.filter((c) => checked[c.task.id] && !c.blocked && !c.deduplicates).length;

  function toggle(candidate: CarryOverCandidate) {
    if (candidate.blocked) return;
    const id = candidate.task.id;
    setChecked((prev) => {
      const willSelect = !prev[id];
      if (willSelect && !candidate.deduplicates) {
        const currentlyUsed = candidates.filter((c) => prev[c.task.id] && !c.blocked && !c.deduplicates).length;
        if (currentlyUsed >= free) return prev; // no free slots left -- can't select another
      }
      return { ...prev, [id]: willSelect };
    });
  }

  const selectedIds = candidates.filter((c) => checked[c.task.id]).map((c) => c.task.id);

  function handleMove() {
    onMove(selectedIds);
  }

  const movableCount = candidates.filter((c) => !c.blocked).length;
  const subtitle = free < movableCount ? `Choose up to ${free}` : 'Choose what to move';
  const moveLabel = selectedIds.length > 0 ? `Move ${selectedIds.length}` : 'Move';
  const moveDisabled = selectedIds.length === 0;

  return (
    <View style={styles.backdrop} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onSkip} />
      <Animated.View style={{ transform: [{ translateY }] }}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Text style={styles.title}>Move unfinished to tomorrow?</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <ScrollView style={styles.list} bounces={false}>
            {candidates.map(({ task, blocked, deduplicates }) => {
              const isSelected = !!checked[task.id];
              const slotsFull = !blocked && !deduplicates && !isSelected && usedSlots >= free;
              const disabled = blocked || slotsFull;
              const textStyle = isSelected
                ? styles.rowTextSelected
                : disabled
                  ? styles.rowTextFaded
                  : styles.rowTextUnselected;
              return (
                <Pressable
                  key={task.id}
                  style={styles.row}
                  onPress={() => toggle({ task, blocked, deduplicates })}
                  disabled={disabled}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isSelected, disabled }}
                >
                  <Text style={[styles.rowText, textStyle]}>
                    {task.text}
                    {task.carryCount >= 1 ? <Text style={styles.counter}>{'  ×' + task.carryCount}</Text> : null}
                  </Text>
                  {isSelected ? (
                    <Text style={styles.checkmark}>✓</Text>
                  ) : blocked ? (
                    <Text style={styles.blockedNote}>can&rsquo;t move again</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={[styles.moveButton, moveDisabled && styles.moveButtonDisabled]}
            onPress={handleMove}
            disabled={moveDisabled}
          >
            <Text style={styles.moveButtonText}>{moveLabel}</Text>
          </Pressable>
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Let them go</Text>
          </Pressable>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      backgroundColor: colors.backdrop,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 20,
      paddingHorizontal: layout.screenPadding,
      maxHeight: '70%',
    },
    title: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
    list: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: layout.rowHeight,
      paddingVertical: 6,
      gap: 12,
    },
    // Spec v8: wraps onto as many lines as needed instead of truncating --
    // minHeight (38) plus this paddingVertical keeps a single-line row the
    // same height as before; longer text just grows the row.
    rowText: { flex: 1, fontSize: 17, lineHeight: 22 },
    rowTextSelected: { color: colors.text },
    rowTextUnselected: { color: colors.muted },
    rowTextFaded: { color: colors.faint },
    checkmark: { color: colors.text, fontSize: 17, fontWeight: '600' },
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
}
