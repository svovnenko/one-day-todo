import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { GearIcon } from '@/components/icons/GearIcon';
import { useTheme } from '@/hooks/useTheme';
import type { Mode, View as SelectedView } from '@/store/useAppStore';
import { type Colors, type } from '@/theme';

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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <View style={styles.labels}>
        <Pressable onPress={() => onSelectView('today')} hitSlop={8}>
          <Text style={[styles.label, selectedView === 'today' && styles.labelActive]}>Today · {todayLabel}</Text>
        </Pressable>
        {mode === 'planning' ? (
          <Pressable onPress={() => onSelectView('tomorrow')} hitSlop={8}>
            <Text style={[styles.label, selectedView === 'tomorrow' && styles.labelActive]}>
              Tomorrow · {tomorrowLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Pressable style={styles.settingsButton} onPress={onPressSettings} accessibilityLabel="Settings">
        <GearIcon size={20} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
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
    // 44x44 hit area (Apple's min tap target); offsets against the row's
    // own padding so the icon lines up where the old inline glyph sat.
    settingsButton: {
      width: 44,
      height: 44,
      marginRight: -12,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
