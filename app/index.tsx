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
    // Never leave the app stuck on the native splash if this throws --
    // log it; the safety-net timer in app/_layout.tsx hides it regardless.
    try {
      init();
    } catch (error) {
      logDevError('HomeScreen init', error);
    }
  }, [init]);

  // Hides the launch splash as soon as the store is ready, rather than
  // waiting on the 3s safety-net timer in app/_layout.tsx.
  useEffect(() => {
    if (isReady) hideSplashOnce();
  }, [isReady]);

  // Keeps today/tomorrow and the view default in sync: AppState-active, and timers to the next E/P.
  useDayClock();

  useCarrySheetReveal();

  /**
   * Marks the row 'hidden' once its animation finishes. Reads
   * `completion` from the live store, not the closed-over value, since
   * this fires from a timeout chain rooted well before this render. No
   * LayoutAnimation here (spec v8 fix) -- it clipped a neighboring row's height before.
   */
  const handleAnimationComplete = useCallback(
    (task: { id: string }) => {
      if (useAppStore.getState().completion[task.id] === undefined) return;
      markHidden(task.id);
    },
    [markHidden]
  );

  /**
   * Restores every task in the batch. Bumping `restoreVersion` (folded
   * into the FlatList key) forces a fresh TaskRow mount instead of
   * reversing a part-finished animation in place.
   */
  const handleUndo = useCallback(() => {
    undoPending();
  }, [undoPending]);

  // Skip/backdrop-tap/Move must always hide the sheet even if the store
  // update itself throws -- hideCarrySheet can't fail the same way.
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

  // Stable unless todayTasks/completion change -- so CarryOverSheet can tell a new list from an unrelated re-render.
  const todayUnfinishedTasks = useMemo(() => excludeCompleting(todayTasks, completion), [todayTasks, completion]);

  // Stable so unrelated re-renders don't hand UndoButton a "new" object that restarts its ring.
  const undoBatchInfo: UndoBatchInfo | null = useMemo(
    () => (pendingBatch ? { version: pendingBatch.version, count: pendingBatch.tasks.length } : null),
    [pendingBatch]
  );

  const rawTasks = selectedView === 'today' ? todayTasks : tomorrowTasks;
  const tasks = useMemo(() => visibleTasks(rawTasks, completion), [rawTasks, completion]);

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

  // Spec 3.4/4 v6: "Done for today." only once a batch has emptied the list by finishing tasks.
  const emptyMessage =
    selectedView === 'today' && lastCompletedDate === todayDay ? 'Done for today.' : 'Nothing here. Tap + to add.';

  // Spec 3.2/3.4: up to two footer lines, computed by useFooterLines
  // (wraps footerLines()) so combinations are unit tested, not re-derived here.
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
          No "tap outside to close" Pressable here -- it would race the
          row's own gesture-handler Swipeable for the same touch. Taps
          outside a row blur natively via keyboardShouldPersistTaps.
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
