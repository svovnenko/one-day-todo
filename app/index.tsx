import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddFab } from '@/components/AddFab';
import { CarryOverSheet } from '@/components/CarryOverSheet';
import { Header } from '@/components/Header';
import { InputBar } from '@/components/InputBar';
import { TaskRow } from '@/components/TaskRow';
import { UndoButton, type UndoBatchInfo } from '@/components/UndoButton';
import type { Task } from '@/db/tasksRepo';
import { useAutoScroll } from '@/hooks/useAutoScroll';
import { useCarrySheetReveal } from '@/hooks/useCarrySheetReveal';
import { useDayClock } from '@/hooks/useDayClock';
import { useFooterLines } from '@/hooks/useFooterLines';
import { useInputSession } from '@/hooks/useInputSession';
import { useTheme } from '@/hooks/useTheme';
import { excludeCompleting, visibleTasks } from '@/logic/completion';
import { formatHeaderDate, parseDayKey } from '@/logic/dates';
import { logDevError } from '@/logic/devError';
import { hideSplashOnce } from '@/logic/splash';
import { useAppStore } from '@/store/useAppStore';
import { type Colors, layout, type } from '@/theme';

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const isReady = useAppStore((s) => s.isReady);
  const selectedView = useAppStore((s) => s.selectedView);
  const mode = useAppStore((s) => s.mode);
  const todayDay = useAppStore((s) => s.todayDay);
  const tomorrowDay = useAppStore((s) => s.tomorrowDay);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const lastCompletedDate = useAppStore((s) => s.settings.lastCompletedDate);
  const pendingBatch = useAppStore((s) => s.pendingBatch);
  const completion = useAppStore((s) => s.completion);
  const restoreVersion = useAppStore((s) => s.restoreVersion);
  const carrySheetVisible = useAppStore((s) => s.carrySheetVisible);
  const init = useAppStore((s) => s.init);
  const beginComplete = useAppStore((s) => s.beginComplete);
  const markHidden = useAppStore((s) => s.markHidden);
  const undoPending = useAppStore((s) => s.undoPending);
  const setSelectedView = useAppStore((s) => s.setSelectedView);
  const openCarrySheet = useAppStore((s) => s.openCarrySheet);
  const hideCarrySheet = useAppStore((s) => s.hideCarrySheet);
  const skipCarrySheet = useAppStore((s) => s.skipCarrySheet);
  const moveCarryOverTasks = useAppStore((s) => s.moveCarryOverTasks);

  const router = useRouter();
  const listRef = useRef<FlatList<Task>>(null);
  const { handleListAreaLayout, handleContentSizeChange, flagScrollToEnd } = useAutoScroll(listRef);
  const { inputVisible, isCurrentListFull, handleAdd, handleInputClose, handleFabPress } =
    useInputSession(flagScrollToEnd);

  useEffect(() => {
    // Never leave the app stuck on the native splash screen if this
    // throws -- log it and let the (still-rendered, blank) screen show
    // instead; the safety-net timer in app/_layout.tsx hides the splash
    // regardless after a few seconds either way.
    try {
      init();
    } catch (error) {
      logDevError('HomeScreen init', error);
    }
  }, [init]);

  // Hides the launch splash the moment the store is ready, so the splash
  // goes straight to the real list instead of to a blank white frame
  // while `!isReady` (that blank frame is still the fallback if init()
  // above throws before ever setting isReady, which is what the 3s
  // safety-net timer in app/_layout.tsx is for).
  useEffect(() => {
    if (isReady) hideSplashOnce();
  }, [isReady]);

  // Keeps today/tomorrow and the Today/Tomorrow default in sync while the
  // app runs: AppState-active, and timers to the next day-end/planning time.
  useDayClock();

  useCarrySheetReveal();

  /**
   * This row's own completion animation (strike-through, fade, collapse)
   * has finished -- marks it 'hidden' in the store, which is what
   * actually removes it from the rendered list (via `visibleTasks`
   * below). A no-op inside `markHidden` itself if Undo already restored
   * it, or the batch already committed some other way -- reading
   * `completion` from the live store here (rather than this render's
   * closed-over value) means that check is correct even though TaskRow
   * calls this from a closure chain rooted well before this specific
   * function instance existed (setTimeout -> Animated .start() ->
   * .start()).
   *
   * Deliberately does NOT call LayoutAnimation here (a bug fixed in spec
   * v8): by this point the row has already shrunk itself to zero height
   * via its own Animated.timing, so removing it from the array is a
   * zero-pixel change on its own -- LayoutAnimation had nothing left to
   * usefully animate, and applying a second, native-level automatic
   * transition on top of a still-live per-row Animated one is exactly
   * the kind of overlap that left a neighboring row clipped to half its
   * height in the owner's screenshot (both systems fighting over the
   * same view's height in the same commit).
   *
   * Wrapped in useCallback with an empty dependency array -- nothing it
   * reads (useAppStore.getState, markHidden) ever changes, so this
   * reference is stable across every render, which is required for
   * React.memo(TaskRow) to actually skip re-rendering rows whose task
   * data hasn't changed.
   */
  const handleAnimationComplete = useCallback(
    (task: { id: string }) => {
      if (useAppStore.getState().completion[task.id] === undefined) return;
      markHidden(task.id);
    },
    [markHidden]
  );

  /**
   * Restores every task in the pending batch (spec 3.2). The store's
   * `restoreVersion` (bumped per task by `undoPending`) is folded into
   * the FlatList's key, forcing a fresh TaskRow mount for each restored
   * task -- that's what actually makes a restored row look normal again.
   * Clearing its `completion` entry alone isn't enough if Undo is tapped
   * WHILE the row's own strike-through/fade/collapse animation is still
   * running: that row is just sitting there mid-animation with
   * isCompleting/isCollapsing already true and opacity/height already
   * animating toward 0. Manually resetting every piece of that animated
   * state (stopping two Animated.timings, restoring opacity to 1,
   * dropping the collapsed height, un-striking the text, and closing the
   * swipeable) would be fiddly and easy to get subtly wrong; forcing an
   * unmount+remount via the key resets all of it at once, guaranteed, the
   * same way a genuinely fresh task row already does.
   *
   * Deliberately does NOT call LayoutAnimation here either (see the
   * comment on handleAnimationComplete above) -- the restored row simply
   * reappears via the normal React/FlatList layout pass, rather than
   * fighting the row it's replacing's own still-unwinding Animated
   * collapse for control of the same native view.
   */
  const handleUndo = useCallback(() => {
    undoPending();
  }, [undoPending]);

  // Skip, the backdrop tap, and Move must always hide the sheet, even if
  // the store update itself throws -- hideCarrySheet is a single,
  // unconditional state set that can't fail the same way.
  const handleSkipCarrySheet = useCallback(() => {
    try {
      skipCarrySheet();
    } finally {
      hideCarrySheet();
    }
  }, [skipCarrySheet, hideCarrySheet]);

  const handleMoveCarryOverTasks = useCallback(
    (taskIds: string[]) => {
      try {
        moveCarryOverTasks(taskIds);
      } finally {
        hideCarrySheet();
      }
    },
    [moveCarryOverTasks, hideCarrySheet]
  );

  // Stable reference unless todayTasks or completion actually change --
  // passed to CarryOverSheet, which otherwise has no way to tell "a new
  // task list" apart from "the same list, re-filtered because the parent
  // re-rendered for an unrelated reason". Excludes every task currently
  // mid-completion (pending or hidden), not just one.
  const todayUnfinishedTasks = useMemo(() => excludeCompleting(todayTasks, completion), [todayTasks, completion]);

  // Stable {version, count} for the Undo button -- derived from
  // pendingBatch (whose reference only changes when the store actually
  // updates it), memoized so re-renders for unrelated reasons don't hand
  // UndoButton a "new" object that would needlessly restart its ring.
  const undoBatchInfo: UndoBatchInfo | null = useMemo(
    () => (pendingBatch ? { version: pendingBatch.version, count: pendingBatch.tasks.length } : null),
    [pendingBatch]
  );

  // Memoized so this array's own reference stays stable across renders
  // that don't actually change which tasks should show (e.g. the Undo
  // button's ring animation ticking, or anything else re-rendering this
  // screen for an unrelated reason) -- on its own this wouldn't stop
  // TaskRow from re-rendering (React.memo compares its OWN `task` prop,
  // not this array), but it does mean FlatList doesn't have to redo its
  // internal bookkeeping for a `data` array that's reference-different
  // but content-identical to last time.
  const rawTasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const tasks = useMemo(() => visibleTasks(rawTasks, completion), [rawTasks, completion]);

  // Stable list props, so FlatList doesn't treat every keystroke (or any
  // other unrelated re-render) as "everything about this list might have
  // changed". keyExtractor still legitimately depends on restoreVersion
  // (it needs to change when a task is restored); the others depend on
  // nothing that changes outside of a real list update.
  const keyExtractor = useCallback((item: Task) => `${item.id}:${restoreVersion[item.id] ?? 0}`, [restoreVersion]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Task>) => (
      <TaskRow task={item} onSwipeThreshold={beginComplete} onAnimationComplete={handleAnimationComplete} />
    ),
    [beginComplete, handleAnimationComplete]
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, tasks.length === 0 && styles.emptyContainer],
    [tasks.length, styles]
  );

  // Spec 3.4/4 v6: Today's empty state is "Done for today." once a batch
  // committed today has actually emptied it by finishing tasks -- Tomorrow
  // always gets the normal prompt, and so does Today before that's true.
  const emptyMessage =
    selectedView === 'today' && lastCompletedDate === todayDay ? 'Done for today.' : 'Nothing here. Tap + to add.';

  // Spec 3.2/3.4: up to two lines at the end of the list -- the "list
  // full" line and the carry-over line/link -- computed by useFooterLines
  // (wrapping the pure footerLines() helper) so every combination is unit
  // tested there instead of re-derived in JSX.
  const footerLineList = useFooterLines();
  const footerElement = useMemo(() => {
    if (footerLineList.length === 0) return null;
    return (
      <View style={styles.footerBlock}>
        {footerLineList.map((line) =>
          line.tappable ? (
            <Pressable
              key={line.text}
              onPress={openCarrySheet}
              hitSlop={{ top: 8, bottom: 8 }}
              style={({ pressed }) => pressed && styles.footerLinePressed}
            >
              <Text style={styles.footerLineText}>{line.text}</Text>
            </Pressable>
          ) : (
            <Text key={line.text} style={styles.footerLineText}>
              {line.text}
            </Text>
          )
        )}
      </View>
    );
  }, [footerLineList, openCarrySheet, styles]);

  if (!isReady) {
    return <SafeAreaView testID="home-screen" style={styles.screen} />;
  }

  const todayLabel = formatHeaderDate(parseDayKey(todayDay));
  const tomorrowLabel = formatHeaderDate(parseDayKey(tomorrowDay));

  return (
    <SafeAreaView testID="home-screen" style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Header
          todayLabel={todayLabel}
          tomorrowLabel={tomorrowLabel}
          selectedView={selectedView}
          mode={mode}
          onSelectView={setSelectedView}
          onPressSettings={() => router.push('/settings')}
        />

        {/*
          Deliberately no "tap outside to close" Pressable wraps this
          list: a tap on a row would reach BOTH it and the row's own
          touch handling (different touch systems -- rows sit inside a
          gesture-handler Swipeable), racing each other for the same tap.
          Closing on "tap outside" is handled entirely by
          keyboardShouldPersistTaps="handled" (a tap on a row never
          auto-dismisses the keyboard) plus InputBar's own keyboardDidHide
          listener (anything else -- empty list space, the header --
          blurs the TextInput natively, which closes the bar from there).
        */}
        <View style={styles.listArea} onLayout={handleListAreaLayout}>
          <FlatList
            ref={listRef}
            data={tasks}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={contentContainerStyle}
            ListEmptyComponent={<Text style={styles.empty}>{emptyMessage}</Text>}
            renderItem={renderItem}
            ListFooterComponent={footerElement}
            onContentSizeChange={handleContentSizeChange}
          />
        </View>

        {inputVisible ? <InputBar onAdd={handleAdd} onClose={handleInputClose} /> : null}
      </KeyboardAvoidingView>

      {!inputVisible ? <AddFab onPress={handleFabPress} isFull={isCurrentListFull} /> : null}
      <UndoButton batch={undoBatchInfo} onUndo={handleUndo} />

      <CarryOverSheet
        visible={carrySheetVisible}
        tasks={todayUnfinishedTasks}
        tomorrowTasks={tomorrowTasks}
        onMove={handleMoveCarryOverTasks}
        onSkip={handleSkipCarrySheet}
      />
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    listArea: { flex: 1 },
    listContent: { paddingTop: layout.listTopGap, paddingBottom: layout.fabSize + 32 },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    empty: { fontSize: type.empty, color: colors.muted },
    footerBlock: { paddingHorizontal: layout.screenPadding, marginTop: 12, gap: 6 },
    footerLineText: { fontSize: type.header, color: colors.muted },
    footerLinePressed: { opacity: 0.5 },
  });
}
