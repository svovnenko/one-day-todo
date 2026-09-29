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
import { Header } from '@/components/Header';
import { InputBar } from '@/components/InputBar';
import { TaskRow } from '@/components/TaskRow';
import { formatHeaderDate, parseDayKey } from '@/logic/dates';
import { useAppStore } from '@/store/useAppStore';
import { colors, layout, type } from '@/theme';

export default function HomeScreen() {
  const isReady = useAppStore((s) => s.isReady);
  const selectedView = useAppStore((s) => s.selectedView);
  const todayDay = useAppStore((s) => s.todayDay);
  const tomorrowDay = useAppStore((s) => s.tomorrowDay);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const init = useAppStore((s) => s.init);
  const addTask = useAppStore((s) => s.addTask);
  const setSelectedView = useAppStore((s) => s.setSelectedView);

  const router = useRouter();
  const inputRef = useRef<TextInput>(null);
  const [inputVisible, setInputVisible] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (inputVisible) {
      // Focus once the input bar has mounted.
      const id = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(id);
    }
  }, [inputVisible]);

  function commitDraft() {
    const text = draft;
    setDraft('');
    if (text.trim().length > 0) {
      addTask(selectedView, text);
    }
  }

  function handleSubmit() {
    // Return adds the task and keeps the keyboard open for fast entry.
    commitDraft();
  }

  function closeInput() {
    commitDraft();
    Keyboard.dismiss();
    setInputVisible(false);
  }

  function openInput() {
    setInputVisible(true);
  }

  if (!isReady) {
    return <SafeAreaView style={styles.screen} />;
  }

  const tasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const todayLabel = formatHeaderDate(parseDayKey(todayDay));
  const tomorrowLabel = formatHeaderDate(parseDayKey(tomorrowDay));

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
            renderItem={({ item }) => <TaskRow task={item} />}
          />
        </Pressable>

        {inputVisible ? (
          <InputBar ref={inputRef} value={draft} onChangeText={setDraft} onSubmit={handleSubmit} />
        ) : null}
      </KeyboardAvoidingView>

      {!inputVisible ? <AddFab onPress={openInput} /> : null}
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
});
