import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppStore } from '@/store/useAppStore';
import { colors, type } from '@/theme';

/**
 * Milestone 2 checkpoint screen: proves the SQLite data layer + Zustand
 * store work end to end (add / list / delete, persisted across restarts).
 * The pixel-matched UI (header, FAB, input bar, swipe-to-complete) lands in
 * later milestones.
 */
export default function HomeScreen() {
  const isReady = useAppStore((s) => s.isReady);
  const selectedView = useAppStore((s) => s.selectedView);
  const todayTasks = useAppStore((s) => s.todayTasks);
  const tomorrowTasks = useAppStore((s) => s.tomorrowTasks);
  const init = useAppStore((s) => s.init);
  const addTask = useAppStore((s) => s.addTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const setSelectedView = useAppStore((s) => s.setSelectedView);

  const [draft, setDraft] = useState('');

  useEffect(() => {
    init();
  }, [init]);

  if (!isReady) {
    return <SafeAreaView style={styles.screen} />;
  }

  const tasks = selectedView === 'today' ? todayTasks : tomorrowTasks;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => setSelectedView('today')}>
          <Text style={[styles.headerLabel, selectedView === 'today' && styles.headerLabelActive]}>Today</Text>
        </Pressable>
        <Pressable onPress={() => setSelectedView('tomorrow')}>
          <Text style={[styles.headerLabel, selectedView === 'tomorrow' && styles.headerLabelActive]}>
            Tomorrow
          </Text>
        </Pressable>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={tasks.length === 0 ? styles.emptyContainer : undefined}
        ListEmptyComponent={<Text style={styles.empty}>Nothing here. Tap + to add.</Text>}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onLongPress={() => deleteTask(item.id)}>
            <Text style={styles.taskText}>{item.text}</Text>
            {item.carryCount >= 1 ? <Text style={styles.counter}> ×{item.carryCount}</Text> : null}
          </Pressable>
        )}
      />

      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="New task"
          returnKeyType="done"
          onSubmitEditing={() => {
            addTask(selectedView, draft);
            setDraft('');
          }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  headerLabel: { fontSize: type.header, color: colors.muted },
  headerLabelActive: { color: colors.text, fontWeight: '500' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: type.empty, color: colors.muted },
  row: {
    minHeight: 38,
    paddingHorizontal: 16,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  taskText: { fontSize: type.task, color: colors.text },
  counter: { fontSize: type.counter, color: colors.faint },
  inputBar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: { fontSize: type.input, color: colors.text },
});
