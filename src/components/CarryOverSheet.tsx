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
  const { height: windowHeight } = useWindowDimensions();
  // Spec v8.1: a numeric point value, not a percentage string -- a
  // percentage maxHeight can't resolve against this sheet's own parent
  // (an Animated.View sized by ITS content, i.e. by this sheet), which is
  // exactly what left the row list squeezed to almost nothing before.
  const sheetMaxHeight = Math.round(windowHeight * SHEET_HEIGHT_FRACTION);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  // Lazy useState instead of useRef: only ever mutated through its own
  // methods (setValue/timing), never reassigned, so it's a one-time
  // value rather than a mutable ref cell -- safe to read during render.
  const [translateY] = useState(() => new Animated.Value(SHEET_OFFSCREEN_OFFSET));
  // Tracks the previous `visible` so the hidden -> visible transition can
  // be detected below, the same thing the old effect's `[visible]`
  // dependency array did.
  const [wasVisible, setWasVisible] = useState(visible);
  // Compared below to decide whether the row list is actually scrolled
  // (vs. just sized to fit) -- drives the scroll indicator's bottom fade.
  const [listHeight, setListHeight] = useState(0);
  const [listContentHeight, setListContentHeight] = useState(0);
  const isListScrollable = listContentHeight > listHeight + 1;

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
    // No maxHeight here any more -- it's computed in points from
    // useWindowDimensions() and merged in at render time (see
    // sheetMaxHeight above). A percentage string can't resolve against
    // this sheet's own parent (an Animated.View sized BY this sheet's
    // content), which is exactly what squeezed the row list down to
    // almost nothing before (spec v8.1).
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
    // flexShrink: 1 (RN's default is 0) is what actually lets this list
    // give up height to the sheet's maxHeight once the title/subtitle/
    // buttons around it (all flexShrink: 0 by default) have claimed
    // theirs -- without it the list would just overflow past the sheet's
    // cap instead of becoming scrollable.
    list: { flexGrow: 0, flexShrink: 1 },
    listFade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
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
    // Spec v8.1: a dedicated token, not `faint` -- a dimmer version of the
    // active black/white button still looked nearly enabled, especially
    // in dark mode (a light grey pill with black text).
    moveButtonDisabled: { backgroundColor: colors.disabledBackground },
    moveButtonText: { color: colors.background, fontSize: 17, fontWeight: '600' },
    moveButtonTextDisabled: { color: colors.muted },
    skipButton: { alignItems: 'center', paddingVertical: 16 },
    skipButtonText: { color: colors.muted, fontSize: 15 },
  });
}
