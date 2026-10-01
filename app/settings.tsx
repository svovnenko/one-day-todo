import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useMemo } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/useTheme';
import { ALLOWED_DAY_END_TIMES, formatHHMM, isValidPlanningTime, parseHHMM } from '@/logic/dates';
import type { Appearance } from '@/logic/theme';
import { useAppStore } from '@/store/useAppStore';
import { type Colors, layout } from '@/theme';

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

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
  const { scheme, colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const settings = useAppStore((s) => s.settings);
  const updateSchedule = useAppStore((s) => s.updateSchedule);
  const updateAppearance = useAppStore((s) => s.updateAppearance);

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
                themeVariant={scheme}
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
                    <Text
                      style={[styles.dayEndOptionText, selected && styles.dayEndOptionTextSelected]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {option}
                    </Text>
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

        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.group}>
          <View style={styles.dayEndBlock}>
            <Text style={styles.rowLabel}>Theme</Text>
            <View style={styles.dayEndSegment}>
              {APPEARANCE_OPTIONS.map(({ value, label }) => {
                const selected = settings.appearance === value;
                return (
                  <Pressable
                    key={value}
                    style={[styles.dayEndOption, selected && styles.dayEndOptionSelected]}
                    onPress={() => updateAppearance(value)}
                  >
                    <Text
                      style={[styles.dayEndOptionText, selected && styles.dayEndOptionTextSelected]}
                      numberOfLines={1}
                      allowFontScaling={false}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
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
    // Spec v8.1: minHeight alone let a tall control (Switch, time picker)
    // sit flush against the divider below -- explicit padding guarantees breathing room.
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 44,
      paddingVertical: 10,
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
      // Spec v8.1: hard clip at the track's rounded edge, so a 5-option
      // row can never bleed past the segment at narrow widths (320pt).
      overflow: 'hidden',
    },
    dayEndOption: {
      flex: 1,
      // Overrides each option's implicit content-based floor -- without
      // it, 5 equal shares can refuse to shrink below their text's width.
      minWidth: 0,
      paddingVertical: 7,
      paddingHorizontal: 2,
      borderRadius: 6,
      alignItems: 'center',
    },
    dayEndOptionSelected: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: colors.shadowOpacity,
      shadowRadius: 2,
      shadowOffset: { width: 0, height: 1 },
      elevation: colors.shadowOpacity > 0 ? 1 : 0,
    },
    dayEndOptionText: { fontSize: 13, color: colors.muted, textAlign: 'center' },
    dayEndOptionTextSelected: { color: colors.text, fontWeight: '600' },
  });
}
