import { forwardRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { colors, type } from '@/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
};

/** Spec 3.3 / 4: docked above the keyboard, white, 1px top border, Return keeps the keyboard open. */
export const InputBar = forwardRef<TextInput, Props>(function InputBar({ value, onChangeText, onSubmit }, ref) {
  return (
    <View style={styles.bar}>
      <TextInput
        ref={ref}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder="New task"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={onSubmit}
        maxLength={200}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: { fontSize: type.input, color: colors.text, padding: 0 },
});
