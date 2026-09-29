import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, type } from '@/theme';
import type { Mode, View as SelectedView } from '@/store/useAppStore';

type Props = {
  todayLabel: string;
  tomorrowLabel: string;
  selectedView: SelectedView;
  /** Tomorrow is locked (and its label hidden) in day mode -- spec 3.1/4. */
  mode: Mode;
  onSelectView: (view: SelectedView) => void;
  onPressSettings: () => void;
};

/** Spec 4: "Today · Tue 29 Sep" / "Tomorrow · Wed 30 Sep", selected label black + medium. */
export function Header({ todayLabel, tomorrowLabel, selectedView, mode, onSelectView, onPressSettings }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Pressable onPress={() => onSelectView('today')} hitSlop={8}>
          <Text style={[styles.label, selectedView === 'today' && styles.labelActive]}>
            Today · {todayLabel}
          </Text>
        </Pressable>
        {mode === 'planning' ? (
          <Pressable onPress={() => onSelectView('tomorrow')} hitSlop={8}>
            <Text style={[styles.label, selectedView === 'tomorrow' && styles.labelActive]}>
              Tomorrow · {tomorrowLabel}
            </Text>
          </Pressable>
        ) : null}
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
