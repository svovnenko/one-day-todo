import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
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
import { UndoPill } from '@/components/UndoPill';
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
  const init = useAppStore((s) => s.init);
  const addTask = useAppStore((s) => s.addTask);
  const editTask = useAppStore((s) => s.editTask);
  const completeTask = useAppStore((s) => s.completeTask);
  const undoPending = useAppStore((s) => s.undoPending);
  const setSelectedView = useAppStore((s) => s.setSelectedView);
  const openCarrySheet = useAppStore((s) => s.openCarrySheet);
  const skipCarrySheet = useAppStore((s) => s.skipCarrySheet);
  const moveCarryOverTasks = useAppStore((s) => s.moveCarryOverTasks);

  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  // Keeps today/tomorrow and the Today/Tomorrow default in sync while the
  // app runs: AppState-active, and timers to the next day-end/planning time.
  useDayClock();

  useEffect(() => {
    if (inputVisible) {
      // Focus once the input bar has mounted (or when it re-mounts for a new target).
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [inputVisible]);

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
      const text = draft;
      setDraft('');
      if (text.trim().length > 0) addTask(selectedView, text);
    }
  }

  function closeInput() {
    commitDraft();
    setEditingTaskId(null);
    setDraft('');
    Keyboard.dismiss();
    setInputVisible(false);
  }

  /** Opens the input bar for a new task (task=null) or to edit an existing one. */
  function openInputFor(task: Task | null) {
    commitDraft(); // save whatever was already being entered/edited first
    setEditingTaskId(task?.id ?? null);
    setDraft(task?.text ?? '');
    setInputVisible(true);
  }

  if (!isReady) {
    return <SafeAreaView style={styles.screen} />;
  }

  const rawTasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const tasks = pendingUndo ? rawTasks.filter((t) => t.id !== pendingUndo.task.id) : rawTasks;
  const todayUnfinishedTasks = pendingUndo
    ? todayTasks.filter((t) => t.id !== pendingUndo.task.id)
    : todayTasks;
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
          onSelectView={setSelectedView}
          onPressSettings={() => router.push('/settings')}
        />

        <Pressable
          style={styles.listArea}
          onPress={inputVisible ? closeInput : undefined}
          disabled={!inputVisible}>
          <FlatList
            data={tasks}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.listContent, tasks.length === 0 && styles.emptyContainer]}
            ListEmptyComponent={<Text style={styles.empty}>Nothing here. Tap + to add.</Text>}
            renderItem={({ item }) => (
              <TaskRow task={item} onComplete={completeTask} onEdit={(task) => openInputFor(task)} />
            )}
            ListFooterComponent={
              showFallbackLink ? (
                <Pressable style={styles.fallbackLink} onPress={openCarrySheet}>
                  <Text style={styles.fallbackLinkText}>Move unfinished to tomorrow</Text>
                </Pressable>
              ) : null
            }
          />
        </Pressable>

        {inputVisible ? (
          <InputBar ref={inputRef} value={draft} onChangeText={setDraft} onSubmit={handleSubmit} />
        ) : null}
      </KeyboardAvoidingView>

      {!inputVisible ? <AddFab onPress={() => openInputFor(null)} /> : null}
      {pendingUndo ? <UndoPill onUndo={undoPending} /> : null}

      <CarryOverSheet
        visible={carrySheetVisible}
        tasks={todayUnfinishedTasks}
        onMove={moveCarryOverTasks}
        onSkip={skipCarrySheet}
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
