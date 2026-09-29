import { useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  LayoutChangeEvent,
  ListRenderItemInfo,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Android needs this opted in explicitly; iOS supports LayoutAnimation by
// default. Belt-and-suspenders alongside TaskRow's own height-collapse
// animation (TASK_FIXES_06): by the time a row actually leaves `tasks`
// below, its own animation has already brought it to zero height/opacity,
// so this mainly guards against any residual snap in whatever's left.
if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

import { AddFab } from '@/components/AddFab';
import { CarryOverSheet } from '@/components/CarryOverSheet';
import { Header } from '@/components/Header';
import { InputBar } from '@/components/InputBar';
import { TaskRow } from '@/components/TaskRow';
import { UndoButton, type UndoBatchInfo } from '@/components/UndoButton';
import type { Task } from '@/db/tasksRepo';
import { useDayClock } from '@/hooks/useDayClock';
import { formatHeaderDate, parseDayKey } from '@/logic/dates';
import { isListFull } from '@/logic/limits';
import { hideSplashOnce } from '@/logic/splash';
import { useAppStore } from '@/store/useAppStore';
import { colors, layout, type } from '@/theme';

export default function HomeScreen() {
  const isReady = useAppStore((s) => s.isReady);
  const selectedView = useAppStore((s) => s.selectedView);
  const mode = useAppStore((s) => s.mode);
  const todayDay = useAppStore((s) => s.todayDay);
  const tomorrowDay = useAppStore((s) => s.tomorrowDay);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const pendingBatch = useAppStore((s) => s.pendingBatch);
  const carrySheetVisible = useAppStore((s) => s.carrySheetVisible);
  const carryPromptDue = useAppStore((s) => s.carryPromptDue);
  const init = useAppStore((s) => s.init);
  const addTask = useAppStore((s) => s.addTask);
  const beginComplete = useAppStore((s) => s.beginComplete);
  const undoPending = useAppStore((s) => s.undoPending);
  const setSelectedView = useAppStore((s) => s.setSelectedView);
  const openCarrySheet = useAppStore((s) => s.openCarrySheet);
  const showCarrySheetIfDue = useAppStore((s) => s.showCarrySheetIfDue);
  const hideCarrySheet = useAppStore((s) => s.hideCarrySheet);
  const skipCarrySheet = useAppStore((s) => s.skipCarrySheet);
  const moveCarryOverTasks = useAppStore((s) => s.moveCarryOverTasks);

  const router = useRouter();
  const [inputVisible, setInputVisible] = useState(false);
  // Rows whose own completion animation has finished and should now
  // actually be removed from the list (TASK_FIXES_04) -- kept separate
  // from `pendingBatch` so the list doesn't yank a row out from under its
  // own in-progress animation the instant the swipe threshold is crossed.
  const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(new Set());
  // How many times each task has been restored by Undo (TASK_FIXES_07,
  // item 0b). Folded into the FlatList's key so a restored row always
  // gets a fresh TaskRow mount -- see the comment on handleUndo for why
  // that's needed instead of trying to reset the row's animated state
  // in place.
  const [restoreCounts, setRestoreCounts] = useState<Record<string, number>>({});
  // Spec 3.2 v5: shows "10 tasks max. Finish one first." above the FAB for
  // a couple of seconds -- fired by the FAB, InputBar's Return key, and
  // the keyboard-hide/draft path, all funneled through showListFullMessage.
  const [showFullMessage, setShowFullMessage] = useState(false);
  const fullMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Spec 3.3 v5 (auto-scroll): set right after a successful add, consumed
  // by the FlatList's onContentSizeChange below. listAreaHeightRef tracks
  // the list container's OWN layout height (via its onLayout), which
  // already shrinks when KeyboardAvoidingView makes room for the keyboard
  // -- so the "is the content taller than what's visible" check below
  // naturally accounts for the keyboard/input bar without any extra logic.
  const listRef = useRef<FlatList<Task>>(null);
  const scrollToNewPendingRef = useRef(false);
  const listAreaHeightRef = useRef(0);

  useEffect(() => {
    // OPT-01: never leave the app stuck on the native splash screen if
    // this throws -- log it and let the (still-rendered, blank) screen
    // show instead; the safety-net timer in app/_layout.tsx hides the
    // splash regardless after a few seconds either way.
    try {
      init();
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }, [init]);

  // OPT-01: hides the launch splash the moment the store is ready, so the
  // splash goes straight to the real list instead of to a blank white
  // frame while `!isReady` (that blank frame is still the fallback if
  // init() above throws before ever setting isReady, which is what the
  // 3s safety-net timer in app/_layout.tsx is for).
  useEffect(() => {
    if (isReady) hideSplashOnce();
  }, [isReady]);

  // Keeps today/tomorrow and the Today/Tomorrow default in sync while the
  // app runs: AppState-active, and timers to the next day-end/planning time.
  useDayClock();

  // TASK_FIXES_03: evaluateCarryPrompt (run from runRollover/refreshMode)
  // only marks carryPromptDue -- it never shows the sheet itself, even if
  // that happens while Settings is open or an AppState transition is in
  // flight. Only this screen decides to actually reveal it, and only once
  // it's both focused (e.g. back from Settings) and the app is active.
  // Re-checks whenever carryPromptDue or focus changes, and again on every
  // AppState transition (covers "backgrounded, tap the notification").
  const isFocused = useIsFocused();
  useEffect(() => {
    function tryReveal() {
      if (carryPromptDue && isFocused && AppState.currentState === 'active') {
        showCarrySheetIfDue();
      }
    }
    tryReveal();
    const subscription = AppState.addEventListener('change', tryReveal);
    return () => subscription.remove();
  }, [carryPromptDue, isFocused, showCarrySheetIfDue]);

  // Cleans up the "list full" message's auto-hide timer on unmount.
  useEffect(() => {
    return () => {
      if (fullMessageTimerRef.current) clearTimeout(fullMessageTimerRef.current);
    };
  }, []);

  // Garbage-collects hiddenRowIds: once a task is actually gone from the
  // store's data (deleted for real, e.g. after the Undo window commits),
  // there's no point remembering it was "visually hidden".
  useEffect(() => {
    setHiddenRowIds((prev) => {
      if (prev.size === 0) return prev;
      const stillExists = new Set([...todayTasks, ...tomorrowTasks].map((t) => t.id));
      const next = new Set([...prev].filter((id) => stillExists.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [todayTasks, tomorrowTasks]);

  const showListFullMessage = useCallback(() => {
    if (fullMessageTimerRef.current) clearTimeout(fullMessageTimerRef.current);
    setShowFullMessage(true);
    fullMessageTimerRef.current = setTimeout(() => setShowFullMessage(false), 2000);
  }, []);

  /**
   * Tries to add `text` to whichever list is currently selected (read live
   * from the store, same reasoning as before this task: InputBar never
   * re-renders on unrelated updates, so a closed-over `selectedView` could
   * be stale). Returns whether the input bar should stay open: false both
   * when the list was already full (the store refused, or our own
   * pre-check caught it -- either way the draft is discarded per spec
   * 3.2 v5) and when this add was the one that just reached the limit
   * (closes the bar too, per spec). On any real add, flags the next
   * FlatList content-size change to scroll the new row into view.
   */
  const attemptAdd = useCallback(
    (text: string): boolean => {
      const view = useAppStore.getState().selectedView;
      const countBefore = view === 'today' ? useAppStore.getState().todayTasks.length : useAppStore.getState().tomorrowTasks.length;
      if (isListFull(countBefore)) {
        showListFullMessage();
        return false;
      }
      if (!addTask(view, text)) {
        showListFullMessage(); // safety net -- the store refused despite the pre-check above
        return false;
      }
      scrollToNewPendingRef.current = true;
      const countAfter = view === 'today' ? useAppStore.getState().todayTasks.length : useAppStore.getState().tomorrowTasks.length;
      if (isListFull(countAfter)) {
        showListFullMessage();
        return false;
      }
      return true;
    },
    [addTask, showListFullMessage]
  );

  /** Return, from InputBar: add, and close the bar if that just filled the list. */
  const handleAdd = useCallback(
    (text: string) => {
      if (!attemptAdd(text)) {
        Keyboard.dismiss();
        setInputVisible(false);
      }
    },
    [attemptAdd]
  );

  /** InputBar's keyboard hid: save a non-empty draft (unless the list is full), then close. */
  const handleInputClose = useCallback(
    (text: string) => {
      if (text.trim().length > 0) attemptAdd(text);
      Keyboard.dismiss(); // formality -- it's normally already hidden, since that's what triggered this
      setInputVisible(false);
    },
    [attemptAdd]
  );

  const isCurrentListFull = isListFull(selectedView === 'today' ? todayTasks.length : tomorrowTasks.length);

  const handleFabPress = useCallback(() => {
    if (isCurrentListFull) {
      showListFullMessage();
      return;
    }
    setInputVisible(true);
  }, [isCurrentListFull, showListFullMessage]);

  const handleListAreaLayout = useCallback((e: LayoutChangeEvent) => {
    listAreaHeightRef.current = e.nativeEvent.layout.height;
  }, []);

  const handleContentSizeChange = useCallback((_width: number, height: number) => {
    if (!scrollToNewPendingRef.current) return;
    scrollToNewPendingRef.current = false;
    if (height > listAreaHeightRef.current) {
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  /**
   * This row's own completion animation (strike-through, fade, collapse)
   * has finished -- now actually remove it from the list.
   *
   * TASK_FIXES_07 item 0a: TaskRow calls this from a closure chain rooted
   * in the swipe event (setTimeout -> Animated .start() -> .start()), so
   * the specific function instance it's holding was captured back at
   * swipe time -- BEFORE beginComplete() had updated pendingBatch. Later
   * re-renders of this screen create fresh `handleAnimationComplete`
   * instances, but TaskRow's already-in-flight callback chain keeps
   * calling the frozen one from that first render, whose closure over
   * `pendingBatch` (React state) is permanently stale. Reading
   * useAppStore.getState() here instead bypasses that entirely: it's an
   * imperative, always-current read of the live store, not a react to
   * this component's own props/state, so it's correct regardless of
   * which stale instance of this function ends up calling it.
   *
   * OPT-01: also wrapped in useCallback with an empty dependency array --
   * nothing it reads (useAppStore.getState, setHiddenRowIds) ever
   * changes, so this reference is stable across every render, which is
   * required for React.memo(TaskRow) to actually skip re-rendering rows
   * whose task data hasn't changed.
   */
  const handleAnimationComplete = useCallback((task: { id: string }) => {
    const liveBatch = useAppStore.getState().pendingBatch;
    // If Undo was already pressed (or the batch already committed/lost
    // this task some other way) before this row's own animation finished,
    // don't hide it -- either it's already been restored, or it's already
    // gone from the underlying data (a harmless no-op either way).
    if (!liveBatch?.tasks.some((t) => t.id === task.id)) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHiddenRowIds((prev) => new Set(prev).add(task.id));
  }, []);

  /**
   * Restores every task in the pending batch (spec 3.2 v4). Reads
   * useAppStore.getState() rather than a React-closed-over value, for the
   * same reason as handleAnimationComplete above -- cheap insurance even
   * though, unlike that callback, this one is invoked directly by a
   * fresh UndoButton press rather than from a long-lived closure chain.
   *
   * TASK_FIXES_07 item 0b: bumps each restored task's entry in
   * `restoreCounts`, which is folded into the FlatList's key. That forces
   * a fresh TaskRow mount for it, which is what actually makes a restored
   * row look normal again -- clearing `hiddenRowIds` alone isn't enough
   * if Undo is tapped WHILE the row's own strike-through/fade/collapse
   * animation is still running: that row was never added to
   * `hiddenRowIds` (its animation hasn't reached handleAnimationComplete
   * yet) or in `tasks` filter terms; it's just sitting there mid-animation
   * with isCompleting/isCollapsing already true and opacity/height
   * already animating toward 0. Manually resetting every piece of that
   * animated state (stopping two Animated.timings, restoring opacity to
   * 1, dropping the collapsed height, un-striking the text, and closing
   * the swipeable) would be fiddly and easy to get subtly wrong; forcing
   * an unmount+remount via the key resets all of it at once, guaranteed,
   * the same way a genuinely fresh task row already does.
   */
  const handleUndo = useCallback(() => {
    const liveBatch = useAppStore.getState().pendingBatch;
    const batchTaskIds = liveBatch?.tasks.map((t) => t.id) ?? [];
    undoPending();
    if (batchTaskIds.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setRestoreCounts((prev) => {
        const next = { ...prev };
        for (const id of batchTaskIds) {
          next[id] = (next[id] ?? 0) + 1;
        }
        return next;
      });
      setHiddenRowIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of batchTaskIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    }
  }, [undoPending]);

  // Skip, the backdrop tap, and Move must always hide the sheet, even if
  // the store update itself throws (TASK_FIXES_03) -- hideCarrySheet is a
  // single, unconditional state set that can't fail the same way.
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

  // Stable reference unless todayTasks or the pending batch actually
  // change -- passed to CarryOverSheet, which otherwise has no way to
  // tell "a new task list" apart from "the same list, re-filtered because
  // the parent re-rendered for an unrelated reason" (TASK_FIXES_03).
  // Excludes every task in the batch, not just one (TASK_FIXES_06/07).
  const todayUnfinishedTasks = useMemo(() => {
    if (!pendingBatch) return todayTasks;
    const batchIds = new Set(pendingBatch.tasks.map((t) => t.id));
    return todayTasks.filter((t) => !batchIds.has(t.id));
  }, [todayTasks, pendingBatch]);

  // Stable {version, count} for the Undo button -- derived from
  // pendingBatch (whose reference only changes when the store actually
  // updates it), memoized so re-renders for unrelated reasons don't hand
  // UndoButton a "new" object that would needlessly restart its ring.
  const undoBatchInfo: UndoBatchInfo | null = useMemo(
    () => (pendingBatch ? { version: pendingBatch.version, count: pendingBatch.tasks.length } : null),
    [pendingBatch]
  );

  // OPT-01: memoized so this array's own reference stays stable across
  // renders that don't actually change which tasks should show (e.g. the
  // Undo button's ring animation ticking, or anything else re-rendering
  // this screen for an unrelated reason) -- on its own this wouldn't stop
  // TaskRow from re-rendering (React.memo compares its OWN `task` prop,
  // not this array), but it does mean FlatList doesn't have to redo its
  // internal bookkeeping for a `data` array that's reference-different
  // but content-identical to last time.
  const rawTasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const tasks = useMemo(
    () => rawTasks.filter((t) => !hiddenRowIds.has(t.id)),
    [rawTasks, hiddenRowIds]
  );

  // OPT-01: stable list props, so FlatList doesn't treat every keystroke
  // (or any other unrelated re-render) as "everything about this list
  // might have changed". keyExtractor still legitimately depends on
  // restoreCounts (it needs to change when a task is restored); the
  // others depend on nothing that changes outside of a real list update.
  const keyExtractor = useCallback(
    (item: Task) => `${item.id}:${restoreCounts[item.id] ?? 0}`,
    [restoreCounts]
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Task>) => (
      <TaskRow task={item} onSwipeThreshold={beginComplete} onAnimationComplete={handleAnimationComplete} />
    ),
    [beginComplete, handleAnimationComplete]
  );

  const contentContainerStyle = useMemo(
    () => [styles.listContent, tasks.length === 0 && styles.emptyContainer],
    [tasks.length]
  );

  const showFallbackLink = mode === 'planning' && selectedView === 'today';
  const footerElement = useMemo(
    () =>
      showFallbackLink ? (
        <Pressable style={styles.fallbackLink} onPress={openCarrySheet}>
          <Text style={styles.fallbackLinkText}>Move unfinished to tomorrow</Text>
        </Pressable>
      ) : null,
    [showFallbackLink, openCarrySheet]
  );

  if (!isReady) {
    return <SafeAreaView style={styles.screen} />;
  }

  const todayLabel = formatHeaderDate(parseDayKey(todayDay));
  const tomorrowLabel = formatHeaderDate(parseDayKey(tomorrowDay));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
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
          No "tap outside to close" Pressable wraps this list (see
          TASK_FIXES_04): one used to, with onPress={closeInput}, but a
          tap on a row could reach BOTH it and the row's own touch handling
          (different touch systems -- rows sit inside a gesture-handler
          Swipeable), racing against each other for the same tap. Closing
          on "tap outside" is handled entirely by
          keyboardShouldPersistTaps="handled" (a tap on a row never
          auto-dismisses the keyboard) plus InputBar's own keyboardDidHide
          listener (anything else -- empty list space, the header -- blurs
          the TextInput natively, which closes the bar from there). Rows
          no longer have any tap handler at all (spec 3.2 v4: no editing),
          so this is now purely a leftover-risk note, not a live bug.
        */}
        <View style={styles.listArea} onLayout={handleListAreaLayout}>
          <FlatList
            ref={listRef}
            data={tasks}
            keyExtractor={keyExtractor}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={contentContainerStyle}
            ListEmptyComponent={<Text style={styles.empty}>Nothing here. Tap + to add.</Text>}
            renderItem={renderItem}
            ListFooterComponent={footerElement}
            onContentSizeChange={handleContentSizeChange}
          />
        </View>

        {inputVisible ? <InputBar onAdd={handleAdd} onClose={handleInputClose} /> : null}
      </KeyboardAvoidingView>

      {!inputVisible ? (
        <AddFab onPress={handleFabPress} isFull={isCurrentListFull} showMessage={showFullMessage} />
      ) : null}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  listArea: { flex: 1 },
  listContent: { paddingTop: layout.listTopGap, paddingBottom: layout.fabSize + 32 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: type.empty, color: colors.muted },
  fallbackLink: { paddingHorizontal: layout.screenPadding, paddingVertical: 12 },
  fallbackLinkText: { fontSize: type.header, color: colors.muted },
});
