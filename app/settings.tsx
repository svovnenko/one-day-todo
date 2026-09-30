import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ALLOWED_DAY_END_TIMES, formatHHMM, isValidPlanningTime, parseHHMM } from '@/logic/dates';
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

  /**
   * Day-end (E) and planning time (P) ranges no longer overlap (E is
   * 00:00-04:00, P is 12:00-23:59), so they can never collide -- only P
   * needs its own range check here (spec 3.1 v4).
   */
  function commitPlanningTime(hhmm: string) {
    if (!isValidPlanningTime(hhmm)) {
      Alert.alert('Planning time must be between 12:00 and 23:59.');
      return;
    }
    updateSchedule({ planningTime: hhmm });
  }

  function openAndroidPlanningPicker() {
    DateTimePickerAndroid.open({
      value: timeToDate(settings.planningTime),
      mode: 'time',
      is24Hour: true,
      onChange: (_event, date) => {
        if (date) commitPlanningTime(dateToTime(date));
      },
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Schedule</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Planning time</Text>
            {Platform.OS === 'android' ? (
              <Pressable onPress={openAndroidPlanningPicker}>
                <Text style={styles.rowValue}>{settings.planningTime}</Text>
              </Pressable>
            ) : (
              <DateTimePicker
                mode="time"
                display="compact"
                value={timeToDate(settings.planningTime)}
                onChange={(_event, date) => {
                  if (date) commitPlanningTime(dateToTime(date));
                }}
              />
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.dayEndBlock}>
            <Text style={styles.rowLabel}>Day ends at</Text>
            <View style={styles.dayEndSegment}>
              {ALLOWED_DAY_END_TIMES.map((option) => {
                const selected = settings.dayEndTime === option;
                return (
                  <Pressable
                    key={option}
                    style={[styles.dayEndOption, selected && styles.dayEndOptionSelected]}
                    onPress={() => updateSchedule({ dayEndTime: option })}
                  >
                    <Text style={[styles.dayEndOptionText, selected && styles.dayEndOptionTextSelected]}>{option}</Text>
                  </Pressable>
                );
              })}
            </View>
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
  dayEndBlock: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  dayEndSegment: {
    flexDirection: 'row',
    backgroundColor: colors.swipeBackground,
    borderRadius: 8,
    padding: 2,
  },
  dayEndOption: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 6,
    alignItems: 'center',
  },
  dayEndOptionSelected: {
    backgroundColor: colors.background,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  dayEndOptionText: { fontSize: 13, color: colors.muted },
  dayEndOptionTextSelected: { color: colors.text, fontWeight: '600' },
});
