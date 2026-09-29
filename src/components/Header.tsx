import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/theme';
import type { View as SelectedView } from '@/store/useAppStore';

type Props = {
  todayLabel: string;
  tomorrowLabel: string;
  selectedView: SelectedView;
  onSelectView: (view: SelectedView) => void;
  onPressSettings: () => void;
};

/** Spec 4: "Today · Tue 29 Sep" / "Tomorrow · Wed 30 Sep", selected label black + medium. */
export function Header({ todayLabel, tomorrowLabel, selectedView, onSelectView, onPressSettings }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Pressable onPress={() => onSelectView('today')} hitSlop={8}>
          <Text style={[styles.label, selectedView === 'today' && styles.labelActive]}>
            Today · {todayLabel}
          </Text>
        </Pressable>
        <Pressable onPress={() => onSelectView('tomorrow')} hitSlop={8}>
          <Text style={[styles.label, selectedView === 'tomorrow' && styles.labelActive]}>
            Tomorrow · {tomorrowLabel}
          </Text>
        </Pressable>
      </View>
      <Pressable onPress={onPressSettings} hitSlop={8} accessibilityLabel="Settings">
        <Text style={styles.gear}>⚙</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  labels: { flexDirection: 'row', gap: 16 },
  label: { fontSize: type.header, color: colors.muted },
  labelActive: { color: colors.text, fontWeight: '500' },
  gear: { fontSize: 18, color: colors.muted },
});
