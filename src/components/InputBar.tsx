import { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { MAX_TASK_LENGTH } from '@/logic/limits';
import { type Colors, type } from '@/theme';

/** Spec 3.2 v8: the remaining-characters counter only appears once this close to the limit. */
const COUNTER_THRESHOLD = 10;

type Props = {
  /** Return: add this (non-empty) text and keep the keyboard open for fast entry. */
  onAdd: (text: string) => void;
  /** The keyboard hid for any reason (spec 3.3) -- save `text` if non-empty, then close the bar. */
  onClose: (text: string) => void;
};

/**
 * Spec 3.3/4: docked above the keyboard, 1px top border, Return keeps it
 * open. Starts lowercase; adding is the only use of this bar -- tasks
 * can't be edited (spec 3.2 v4). Owns its own `draft`/keyboardDidHide
 * state so a keystroke only re-renders this component.
 */
export function InputBar({ onAdd, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [draft, setDraft] = useState('');
  // Mirrors `draft` without re-rendering -- read by the keyboardDidHide
  // listener so it always has the latest text without resubscribing.
  const draftRef = useRef('');
  const inputRef = useRef<TextInput>(null);
  // Guards against this bar's own Keyboard.dismiss() (in the parent's
  // onClose) re-triggering this same keyboardDidHide listener -- a plain
  // boolean is enough since each mount only ever has one close to guard.
  const isClosingRef = useRef(false);

  useEffect(() => {
    // Focus once mounted (i.e. once the bar becomes visible).
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      if (isClosingRef.current) return;
      isClosingRef.current = true;
      onClose(draftRef.current);
    });
    return () => subscription.remove();
    // Mount-only: draftRef is always current, and onClose itself reads
    // live store state rather than relying on anything closed over here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleChangeText(text: string) {
    draftRef.current = text;
    setDraft(text);
  }

  function handleSubmit() {
    const text = draftRef.current;
    draftRef.current = '';
    setDraft('');
    if (text.trim().length > 0) onAdd(text);
  }

  const remaining = MAX_TASK_LENGTH - draft.length;

  return (
    <View style={styles.bar}>
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={draft}
        onChangeText={handleChangeText}
        placeholder="New task"
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        blurOnSubmit={false}
        onSubmitEditing={handleSubmit}
        maxLength={MAX_TASK_LENGTH}
        autoCapitalize="none"
      />
      {remaining <= COUNTER_THRESHOLD ? <Text style={styles.counter}>{remaining}</Text> : null}
    </View>
  );
}

function makeStyles(colors: Colors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
    input: { flex: 1, fontSize: type.input, color: colors.text, padding: 0 },
    counter: { fontSize: type.counter, color: colors.muted, marginLeft: 8 },
  });
}
