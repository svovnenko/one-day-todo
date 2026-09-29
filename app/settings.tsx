import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { pickBackupJson, validateBackup } from '@/logic/backup';
import { formatHHMM, parseHHMM, planningRightAfterDayEndHint } from '@/logic/dates';
import { useAppStore } from '@/store/useAppStore';
import { colors, layout } from '@/theme';

/** Builds a Date carrying just a time-of-day, for the native time pickers. */
function timeToDate(hhmm: string): Date {
  const d = new Date();
  d.setHours(Math.floor(parseHHMM(hhmm) / 60), parseHHMM(hhmm) % 60, 0, 0);
  return d;
}

function dateToTime(d: Date): string {
  return formatHHMM(d.getHours() * 60 + d.getMinutes());
}

export default function SettingsScreen() {
  const settings = useAppStore((s) => s.settings);
  const updateSchedule = useAppStore((s) => s.updateSchedule);
  const exportBackup = useAppStore((s) => s.exportBackup);
  const importBackup = useAppStore((s) => s.importBackup);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportBackup();
    } catch (error) {
      Alert.alert('Couldn’t export backup', error instanceof Error ? error.message : String(error));
    } finally {
      setExporting(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    try {
      const json = await pickBackupJson();
      if (json === null) return; // user cancelled the picker

      const backup = validateBackup(json);
      if (!backup) {
        Alert.alert('This file is not a valid backup.');
        return;
      }

      Alert.alert('Replace current tasks and settings with this backup?', undefined, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () => {
            const skippedCount = importBackup(backup);
            if (skippedCount > 0) {
              Alert.alert('Backup restored', `${skippedCount} old ${skippedCount === 1 ? 'task was' : 'tasks were'} skipped.`);
            }
          },
        },
      ]);
    } catch (error) {
      Alert.alert('This file is not a valid backup.');
    } finally {
      setImporting(false);
    }
  }

  function commitTime(field: 'planningTime' | 'dayEndTime', hhmm: string) {
    const other = field === 'planningTime' ? settings.dayEndTime : settings.planningTime;
    if (hhmm === other) {
      Alert.alert('Planning time and day-end time must be different.');
      return;
    }
    updateSchedule({ [field]: hhmm });
  }

  function openAndroidPicker(field: 'planningTime' | 'dayEndTime') {
    DateTimePickerAndroid.open({
      value: timeToDate(field === 'planningTime' ? settings.planningTime : settings.dayEndTime),
      mode: 'time',
      is24Hour: true,
      onChange: (_event, date) => {
        if (date) commitTime(field, dateToTime(date));
      },
    });
  }

  const hint = planningRightAfterDayEndHint(settings.planningTime, settings.dayEndTime);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Planning time</Text>
            {Platform.OS === 'android' ? (
              <Pressable onPress={() => openAndroidPicker('planningTime')}>
                <Text style={styles.rowValue}>{settings.planningTime}</Text>
              </Pressable>
            ) : (
              <DateTimePicker
                mode="time"
                display="compact"
                value={timeToDate(settings.planningTime)}
                onChange={(_event, date) => {
                  if (date) commitTime('planningTime', dateToTime(date));
                }}
              />
            )}
          </View>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Day ends at</Text>
            {Platform.OS === 'android' ? (
              <Pressable onPress={() => openAndroidPicker('dayEndTime')}>
                <Text style={styles.rowValue}>{settings.dayEndTime}</Text>
              </Pressable>
            ) : (
              <DateTimePicker
                mode="time"
                display="compact"
                value={timeToDate(settings.dayEndTime)}
                onChange={(_event, date) => {
                  if (date) commitTime('dayEndTime', dateToTime(date));
                }}
              />
            )}
          </View>
          <Text style={styles.caption}>Tasks left after this time are deleted.</Text>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.rowLabel}>Daily reminder</Text>
            <Switch
              value={settings.reminderEnabled}
              onValueChange={(value) => updateSchedule({ reminderEnabled: value })}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Backup</Text>
        <View style={styles.group}>
          <Pressable style={styles.row} onPress={handleExport} disabled={exporting}>
            <Text style={styles.rowLabel}>Export backup</Text>
            {exporting ? <ActivityIndicator /> : null}
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={handleImport} disabled={importing}>
            <Text style={styles.rowLabel}>Import backup</Text>
            {importing ? <ActivityIndicator /> : null}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingVertical: 24 },
  sectionTitle: {
    fontSize: 13,
    color: colors.muted,
    textTransform: 'uppercase',
    paddingHorizontal: layout.screenPadding,
    marginBottom: 8,
    marginTop: 20,
  },
  group: { backgroundColor: colors.background },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: layout.screenPadding,
  },
  rowLabel: { fontSize: 17, color: colors.text },
  rowValue: { fontSize: 17, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: layout.screenPadding },
  caption: { fontSize: 13, color: colors.muted, paddingHorizontal: layout.screenPadding, paddingBottom: 8 },
  hint: { fontSize: 13, color: colors.muted, paddingHorizontal: layout.screenPadding, paddingBottom: 8 },
});
