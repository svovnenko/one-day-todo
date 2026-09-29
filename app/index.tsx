import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
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
import { useDayClock } from '@/hooks/useDayClock';
import { formatHeaderDate, parseDayKey } from '@/logic/dates';
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
  const inputRef = useRef<TextInput>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [draft, setDraft] = useState('');
  // Rows whose own completion animation has finished and should now
  // actually be removed from the list (TASK_FIXES_04) -- kept separate
  // from `pendingBatch` so the list doesn't yank a row out from under its
  // own in-progress animation the instant the swipe threshold is crossed.
  const [hiddenRowIds, setHiddenRowIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    init();
  }, [init]);

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

  // Guards close/open against a stale keyboardDidHide firing after this
  // session has already ended (e.g. our own Keyboard.dismiss() inside
  // closeInput() triggering the same event again).
  const sessionIdRef = useRef(0);

  useEffect(() => {
    if (inputVisible) {
      // Focus once the input bar has mounted.
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [inputVisible]);

  // Spec 3.3: the input bar closes whenever the keyboard hides for any
  // reason (tap outside, keyboard dismiss, swipe down, leaving the
  // screen). Re-subscribed whenever draft changes so the listener always
  // closes over its latest value, not a stale one from when it opened.
  useEffect(() => {
    if (!inputVisible) return;
    const mySession = sessionIdRef.current;
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (sessionIdRef.current !== mySession) return; // this session already ended
      closeInput();
    });
    return () => subscription.remove();
  }, [inputVisible, draft]);

  /** Saves the draft if non-empty. */
  function commitDraft() {
    if (draft.trim().length > 0) {
      addTask(selectedView, draft);
    }
  }

  function handleSubmit() {
    // Return adds and keeps the keyboard open for fast entry.
    // blurOnSubmit is false on the TextInput, so this never hides the
    // keyboard, and the keyboardDidHide listener above never fires here.
    const text = draft;
    setDraft('');
    if (text.trim().length > 0) addTask(selectedView, text);
  }

  /** Saves any non-empty draft first, then closes the input bar. */
  function closeInput() {
    sessionIdRef.current += 1; // invalidate this session (including our own Keyboard.dismiss() below)
    commitDraft();
    setDraft('');
    Keyboard.dismiss();
    setInputVisible(false);
  }

  function openInput() {
    sessionIdRef.current += 1;
    setInputVisible(true);
  }

  /** This row's own completion animation (strike-through, fade, collapse) has finished -- now actually remove it from the list. */
  function handleAnimationComplete(task: { id: string }) {
    // If Undo was already pressed (or the batch already committed/lost
    // this task some other way) before this row's own animation finished,
    // don't hide it -- either it's already been restored, or it's already
    // gone from the underlying data (a harmless no-op either way).
    if (!pendingBatch?.tasks.some((t) => t.id === task.id)) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setHiddenRowIds((prev) => new Set(prev).add(task.id));
  }

  /** Restores every task in the pending batch (spec 3.2 v4). */
  function handleUndo() {
    const batchTaskIds = pendingBatch?.tasks.map((t) => t.id) ?? [];
    undoPending();
    if (batchTaskIds.length > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setHiddenRowIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const id of batchTaskIds) {
          if (next.delete(id)) changed = true;
        }
        return changed ? next : prev;
      });
    }
  }

  // Skip, the backdrop tap, and Move must always hide the sheet, even if
  // the store update itself throws (TASK_FIXES_03) -- hideCarrySheet is a
  // single, unconditional state set that can't fail the same way.
  function handleSkipCarrySheet() {
    try {
      skipCarrySheet();
    } finally {
      hideCarrySheet();
    }
  }

  function handleMoveCarryOverTasks(taskIds: string[]) {
    try {
      moveCarryOverTasks(taskIds);
    } finally {
      hideCarrySheet();
    }
  }

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
  // updates it), memoized so re-renders for unrelated reasons (e.g.
  // typing a draft) don't hand UndoButton a "new" object that would
  // needlessly restart its ring.
  const undoBatchInfo: UndoBatchInfo | null = useMemo(
    () => (pendingBatch ? { version: pendingBatch.version, count: pendingBatch.tasks.length } : null),
    [pendingBatch]
  );

  if (!isReady) {
    return <SafeAreaView style={styles.screen} />;
  }

  const rawTasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const tasks = rawTasks.filter((t) => !hiddenRowIds.has(t.id));
  const todayLabel = formatHeaderDate(parseDayKey(todayDay));
  const tomorrowLabel = formatHeaderDate(parseDayKey(tomorrowDay));
  const showFallbackLink = mode === 'planning' && selectedView === 'today';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
          auto-dismisses the keyboard) plus the keyboardDidHide listener
          above (anything else -- empty list space, the header -- blurs
          the TextInput natively, which closes the bar from there). Rows
          no longer have any tap handler at all (spec 3.2 v4: no editing),
          so this is now purely a leftover-risk note, not a live bug.
        */}
        <View style={styles.listArea}>
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.listContent, tasks.length === 0 && styles.emptyContainer]}
            ListEmptyComponent={<Text style={styles.empty}>Nothing here. Tap + to add.</Text>}
            renderItem={({ item }) => (
              <TaskRow task={item} onSwipeThreshold={beginComplete} onAnimationComplete={handleAnimationComplete} />
            )}
            ListFooterComponent={
              showFallbackLink ? (
                <Pressable style={styles.fallbackLink} onPress={openCarrySheet}>
                  <Text style={styles.fallbackLinkText}>Move unfinished to tomorrow</Text>
                </Pressable>
              ) : null
            }
          />
        </View>

        {inputVisible ? (
          <InputBar ref={inputRef} value={draft} onChangeText={setDraft} onSubmit={handleSubmit} />
        ) : null}
      </KeyboardAvoidingView>

      {!inputVisible ? <AddFab onPress={openInput} /> : null}
      <UndoButton batch={undoBatchInfo} onUndo={handleUndo} />

      <CarryOverSheet
        visible={carrySheetVisible}
        tasks={todayUnfinishedTasks}
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
