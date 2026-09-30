import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { MAX_TASK_LENGTH } from '@/logic/limits';
import { colors, type } from '@/theme';

/** Spec 3.2 v8: the remaining-characters counter only appears once this close to the limit. */
const COUNTER_THRESHOLD = 10;

type Props = {
  /** Return: add this (non-empty) text and keep the keyboard open for fast entry. */
  onAdd: (text: string) => void;
  /**
   * The keyboard hid for any reason -- tap outside, keyboard dismiss,
   * swipe down, leaving the screen (spec 3.3). The caller should save
   * `text` if it's non-empty, then close the bar (hide it, and dismiss
   * the keyboard as a formality -- it's normally already hidden by the
   * time this fires, since that's what triggered it).
   */
  onClose: (text: string) => void;
};

/**
 * Spec 3.3 / 4: docked above the keyboard, white, 1px top border, Return
 * keeps the keyboard open. The keyboard starts lowercase (autoCapitalize
 * "none") when adding; text is saved exactly as typed. Adding is the only
 * use of this bar -- tasks can't be edited (spec 3.2 v4).
 *
 * Owns its own `draft` state and keyboardDidHide handling: lifting them
 * to the parent screen would re-render it on every keystroke --
 * including the task FlatList and every visible TaskRow/Swipeable.
 * Keeping them here means a keystroke only re-renders this one small
 * component.
 */
export function InputBar({ onAdd, onClose }: Props) {
  const [draft, setDraft] = useState('');
  // Mirrors `draft` without causing a re-render on its own; read by the
  // keyboardDidHide listener below so it always has the latest text
  // without needing to resubscribe on every keystroke.
  const draftRef = useRef('');
  const inputRef = useRef<TextInput>(null);
  // Guards against this bar's own Keyboard.dismiss() (in the parent's
  // onClose handling) re-triggering this same keyboardDidHide listener a
  // second time. A plain boolean suffices: this component mounts fresh
  // for every "open" (the parent only renders it while visible) and is
  // done for good the moment it closes, so there is only ever one close
  // to guard against per mount, never a second session to distinguish
  // from a stale first one.
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
    // Deliberately mount-only: draftRef.current is always current, so
    // this listener never needs the latest `onClose` identity either --
    // it only ever fires once per mount, and onClose's OWN implementation
    // (in the parent) reads live store state rather than relying on
    // anything closed over here.
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  input: { flex: 1, fontSize: type.input, color: colors.text, padding: 0 },
  counter: { fontSize: type.counter, color: colors.muted, marginLeft: 8 },
});
