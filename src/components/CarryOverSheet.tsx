import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

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
/** Spec 3.4 v8.1: the sheet scrolls only once its content would exceed this much of the screen. */
const SHEET_HEIGHT_FRACTION = 0.85;
const LIST_FADE_HEIGHT = 24;

/**
 * Spec 3.4/4 v7: bottom sheet, rounded top, plain text rows (no
 * checkboxes); full-width `Move N` + grey `Let them go`.
 *
 * Not a React Native <Modal> -- presenting one while another native
 * transition is in flight (Settings dismissing, an AppState change)
 * could leave an invisible layer swallowing touches on iOS. This is a
 * plain absolutely positioned View, rendered last so it stacks on top.
 */
export function CarryOverSheet({ visible, tasks, tomorrowTasks, onMove, onSkip }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height: windowHeight } = useWindowDimensions();
  // Spec v8.1: points, not a percentage -- a percentage can't resolve
  // against this sheet's own parent (an Animated.View sized BY this sheet).
  const sheetMaxHeight = Math.round(windowHeight * SHEET_HEIGHT_FRACTION);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // One-time value (only ever mutated via setValue/timing) -- safe to read during render, unlike a ref.
  const [translateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_OFFSET));
  // Tracks the previous `visible` to detect the hidden -> visible transition below.
  const [wasVisible, setWasVisible] = useState(visible);
  // Drives the scroll indicator's bottom fade below.
  const [listHeight, setListHeight] = useState(0);
  const [listContentHeight, setListContentHeight] = useState(0);
  const isListScrollable = listContentHeight > listHeight + 1;

  const candidates = buildCarryOverCandidates(tasks, tomorrowTasks);
  const free = freeSlots(tomorrowTasks.length);

  // Resets to all-unselected the moment the sheet becomes visible --
  // during render, not an effect, so there's no stale-then-corrected
  // flash (spec 3.4 v6: moving a task must be a conscious choice).
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setChecked({});
  }

  // A real side effect (imperative Animated.timing kickoff), so it stays
  // in an effect rather than the render-time adjustment above.
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

  // How many of tomorrow's free slots the selection would consume -- a
  // deduplicating task merges instead of taking a new slot (spec 3.4 v5).
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
        <SafeAreaView edges={['bottom']} style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>
          <Text style={styles.title}>Move unfinished to tomorrow?</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
          <View style={styles.listWrap}>
            <ScrollView
              style={styles.list}
              bounces={false}
              showsVerticalScrollIndicator
              onLayout={(event) => setListHeight(event.nativeEvent.layout.height)}
              onContentSizeChange={(_width, height) => setListContentHeight(height)}
            >
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
            {isListScrollable ? (
              <View style={styles.listFade} pointerEvents="none">
                <Svg width="100%" height={LIST_FADE_HEIGHT}>
                  <Defs>
                    <LinearGradient id="carryOverListFade" x1="0" y1="0" x2="0" y2="1">
                      <Stop offset="0" stopColor={colors.surface} stopOpacity={0} />
                      <Stop offset="1" stopColor={colors.surface} stopOpacity={1} />
                    </LinearGradient>
                  </Defs>
                  <Rect x="0" y="0" width="100%" height={LIST_FADE_HEIGHT} fill="url(#carryOverListFade)" />
                </Svg>
              </View>
            ) : null}
          </View>
          <Pressable
            style={[styles.moveButton, moveDisabled && styles.moveButtonDisabled]}
            onPress={handleMove}
            disabled={moveDisabled}
          >
            <Text style={[styles.moveButtonText, moveDisabled && styles.moveButtonTextDisabled]}>{moveLabel}</Text>
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
    // maxHeight is applied at render time -- see sheetMaxHeight above.
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingTop: 20,
      paddingHorizontal: layout.screenPadding,
    },
    title: { fontSize: 17, fontWeight: '600', color: colors.text, marginBottom: 4 },
    subtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
    listWrap: { position: 'relative' },
    // flexShrink: 1 (RN's default is 0) is what lets this list give up
    // height to the sheet's cap once the fixed-size rows around it have claimed theirs.
    list: { flexGrow: 0, flexShrink: 1 },
    listFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: layout.rowHeight,
      paddingVertical: 6,
      gap: 12,
    },
    // Wraps instead of truncating (spec v8) -- minHeight (38) + this
    // paddingVertical keeps a single-line row the same height as before.
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
    // Spec v8.1: a dedicated token, not `faint` -- a dimmer version of
    // the active color looked nearly enabled, especially in dark mode.
    moveButtonDisabled: { backgroundColor: colors.disabledBackground },
    moveButtonText: { color: colors.background, fontSize: 17, fontWeight: '600' },
    moveButtonTextDisabled: { color: colors.muted },
    skipButton: { alignItems: 'center', paddingVertical: 16 },
    skipButtonText: { color: colors.muted, fontSize: 15 },
  });
}
