import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddFab } from '@/components/AddFab';
import { CarryOverSheet } from '@/components/CarryOverSheet';
import { Header } from '@/components/Header';
import { InputBar } from '@/components/InputBar';
import { TaskRow } from '@/components/TaskRow';
import { UndoButton } from '@/components/UndoButton';
import type { Task } from '@/db/tasksRepo';
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
  const pendingUndo = useAppStore((s) => s.pendingUndo);
  const carrySheetVisible = useAppStore((s) => s.carrySheetVisible);
  const carryPromptDue = useAppStore((s) => s.carryPromptDue);
  const init = useAppStore((s) => s.init);
  const addTask = useAppStore((s) => s.addTask);
  const editTask = useAppStore((s) => s.editTask);
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  // Rows whose own strike-through+fade animation has finished and should
  // now actually be removed from the list (TASK_FIXES_04) -- kept
  // separate from `pendingUndo` so the list doesn't yank a row out from
  // under its own in-progress animation the instant the swipe threshold
  // is crossed.
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

  // TASK_FIXES_04 (bug 2): each input session gets an id. openInputFor()
  // bumps it; closeInput()/cancelInput() also bump it (invalidating even
  // their OWN Keyboard.dismiss() call's later keyboardDidHide). The
  // keyboardDidHide listener below captures the session id it was
  // subscribed under and only acts if it's still current -- so a tap that
  // switches the edit target (openInputFor running before a stale
  // keyboardDidHide from the previous session arrives) can never have
  // that stale event undo the switch.
  const sessionIdRef = useRef(0);

  // Refocuses whenever the input opens AND whenever the edit target
  // changes while it's already open (e.g. tapping a different task, or a
  // just-added one, without the bar ever closing in between) -- depending
  // on [inputVisible] alone missed that second case.
  useEffect(() => {
    if (inputVisible) {
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [inputVisible, editingTaskId]);

  // Spec 3.3: the input bar closes whenever the keyboard hides for any
  // reason (tap outside, keyboard dismiss, swipe down, leaving the
  // screen). Re-subscribed whenever draft/editingTaskId change so the
  // listener always closes over their latest values, not stale ones from
  // when the input first opened.
  useEffect(() => {
    if (!inputVisible) return;
    const mySession = sessionIdRef.current;
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (sessionIdRef.current !== mySession) return; // a newer/closed session owns the input now
      closeInput();
    });
    return () => subscription.remove();
  }, [inputVisible, editingTaskId, draft]);

  /** Saves whatever is currently in the input (add, or edit of `editingTaskId`). */
  function commitDraft() {
    if (editingTaskId) {
      editTask(editingTaskId, draft);
    } else if (draft.trim().length > 0) {
      addTask(selectedView, draft);
    }
  }

  function handleSubmit() {
    if (editingTaskId) {
      // Editing is a single-task operation: Return saves and closes.
      closeInput();
    } else {
      // Adding: Return adds and keeps the keyboard open for fast entry.
      // blurOnSubmit is false on the TextInput, so this never hides the
      // keyboard, and the keyboardDidHide listener above never fires here.
      const text = draft;
      setDraft('');
      if (text.trim().length > 0) addTask(selectedView, text);
    }
  }

  /** Saves any non-empty draft first, then closes the input bar. */
  function closeInput() {
    sessionIdRef.current += 1; // invalidate this session (including our own Keyboard.dismiss() below)
    commitDraft();
    const wasEditingId = editingTaskId;
    setEditingTaskId(null);
    setDraft('');
    Keyboard.dismiss();
    setInputVisible(false);
    // No swipe animation plays for an edit-to-empty completion (spec 3.2),
    // so hide it immediately rather than waiting for a callback that will
    // never come from TaskRow.
    if (wasEditingId && draft.trim().length === 0) {
      setHiddenRowIds((prev) => new Set(prev).add(wasEditingId));
    }
  }

  /**
   * Closes the input bar WITHOUT saving -- used when the task being edited
   * is completed or deleted out from under it (spec 3.3).
   */
  function cancelInput() {
    sessionIdRef.current += 1;
    setEditingTaskId(null);
    setDraft('');
    setInputVisible(false);
    Keyboard.dismiss();
  }

  /** Opens the input bar for a new task (task=null) or to edit an existing one. */
  function openInputFor(task: Task | null) {
    sessionIdRef.current += 1; // fresh session, invalidates any still-in-flight listener from the previous one
    commitDraft(); // save whatever was already being entered/edited first
    setEditingTaskId(task?.id ?? null);
    setDraft(task?.text ?? '');
    setInputVisible(true);
  }

  /** Swipe threshold crossed: start the Undo window immediately (spec 3.2/4). */
  function handleSwipeThreshold(task: Task) {
    if (task.id === editingTaskId) {
      cancelInput();
    }
    beginComplete(task);
  }

  /** This row's own strike-through+fade has finished -- now actually remove it from the list. */
  function handleAnimationComplete(task: Task) {
    // If Undo was already pressed (or a newer completion superseded this
    // one) before this row's own animation finished, don't hide it --
    // either it's already been restored, or it's already gone from the
    // underlying data (in which case this is a harmless no-op).
    if (pendingUndo?.task.id !== task.id) return;
    setHiddenRowIds((prev) => new Set(prev).add(task.id));
  }

  function handleUndo() {
    const task = pendingUndo?.task;
    undoPending();
    if (task) {
      setHiddenRowIds((prev) => {
        if (!prev.has(task.id)) return prev;
        const next = new Set(prev);
        next.delete(task.id);
        return next;
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

  // Stable reference unless todayTasks or the pending task actually change
  // -- passed to CarryOverSheet, which otherwise has no way to tell "a new
  // task list" apart from "the same list, re-filtered because the parent
  // re-rendered for an unrelated reason" (TASK_FIXES_03).
  const todayUnfinishedTasks = useMemo(
    () => (pendingUndo ? todayTasks.filter((t) => t.id !== pendingUndo.task.id) : todayTasks),
    [todayTasks, pendingUndo]
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
          No outer "tap outside to close" Pressable here (TASK_FIXES_04,
          bug 2, suspect 3): one used to wrap this list with
          onPress={closeInput}, but a tap on a row could reach BOTH it and
          the row's own Pressable (they sit in different touch systems --
          the row is inside a gesture-handler Swipeable), racing
          openInputFor against closeInput for the same tap. Closing on
          "tap outside" is instead handled entirely by keyboardShouldPersistTaps="handled"
          (taps a row handles never auto-dismiss the keyboard) plus the
          keyboardDidHide listener above (any tap that ISN'T handled by a
          row -- empty list space, the header, elsewhere -- blurs the
          TextInput natively, which closes the input bar from there).
        */}
        <View style={styles.listArea}>
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.listContent, tasks.length === 0 && styles.emptyContainer]}
            ListEmptyComponent={<Text style={styles.empty}>Nothing here. Tap + to add.</Text>}
            renderItem={({ item }) => (
              <TaskRow
                task={item}
                onSwipeThreshold={handleSwipeThreshold}
                onAnimationComplete={handleAnimationComplete}
                onEdit={(task) => openInputFor(task)}
              />
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

      {!inputVisible ? <AddFab onPress={() => openInputFor(null)} /> : null}
      <UndoButton taskId={pendingUndo?.task.id ?? null} onUndo={handleUndo} />

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
