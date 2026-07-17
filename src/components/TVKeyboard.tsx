import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useT } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme/tokens';

// In-app D-pad keyboard for the box. The system IME on Android TV fights
// react-native-tvos native focus (upstream issues #901/#155/#129: focus escapes
// to the first focusable, the keyboard won't open on OK, arrows die) and made
// text entry unusable no matter how Field drove it. Professional IPTV apps ship
// their OWN keyboard for exactly this reason. Every key here is a plain
// Focusable inside a FocusLayer — the two primitives that have always worked on
// the box (all buttons + the PIN/updater modals) — so typing cannot lose the
// cursor by construction: no EditText, no IME, no native text-focus at all.
// Made in Italy.

// First row is IDENTICAL on both pages so the '1' key (the autoFocus target)
// is never remounted by the ABC/#+= toggle — a remount would steal focus.
const LETTER_ROWS = ['1234567890', 'abcdefghij', 'klmnopqrst', 'uvwxyz@._-'];
const SYMBOL_ROWS = ['1234567890', ':/?&=%#+-*', '!,;()[]{}~', '"\'<>\\|^`€$'];
const NUMBER_ROWS = ['123', '456', '789', '0'];

export type TVKeyboardKind = 'text' | 'url' | 'number';

export function TVKeyboard({
  visible,
  title,
  value,
  kind = 'text',
  onDone,
  onCancel,
}: {
  visible: boolean;
  /** Shown above the preview so the user knows which field they are filling. */
  title: string;
  /** Text at open time; edited internally, committed only on "Fine". */
  value: string;
  kind?: TVKeyboardKind;
  onDone: (text: string) => void;
  onCancel: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(value);
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);

  // Snapshot the field value each time the keyboard opens.
  useEffect(() => {
    if (visible) {
      setText(value);
      setShift(false);
      setSymbols(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const add = (ch: string) => {
    setText((s) => s + (shift ? ch.toUpperCase() : ch));
    if (shift) setShift(false); // one-shot shift, like every TV keyboard
  };
  const back = () => setText((s) => s.slice(0, -1));

  const numeric = kind === 'number';
  const rows = numeric ? NUMBER_ROWS : symbols ? SYMBOL_ROWS : LETTER_ROWS;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {visible ? (
        <FocusLayer>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Text style={styles.title}>{title}</Text>
              <View style={styles.preview}>
                {/* Always clear text while editing (TV standard: typing blind
                    with a remote is hopeless); the field masks it afterwards. */}
                <Text style={styles.previewText} numberOfLines={1}>
                  {text}
                  <Text style={styles.caret}>▏</Text>
                </Text>
              </View>

              {rows.map((row, ri) => (
                <View key={ri} style={styles.row}>
                  {[...row].map((ch) => (
                    <Key
                      key={ch}
                      label={shift ? ch.toUpperCase() : ch}
                      onPress={() => add(ch)}
                      autoFocus={ri === 0 && ch === '1'}
                    />
                  ))}
                </View>
              ))}

              <View style={styles.row}>
                {!numeric ? <Key wide label="⇧" active={shift} onPress={() => setShift((s) => !s)} /> : null}
                {!numeric ? (
                  <Key wide label={symbols ? 'ABC' : '#+='} active={symbols} onPress={() => setSymbols((s) => !s)} />
                ) : null}
                {!numeric ? <Key grow label={t('kb.space')} onPress={() => add(' ')} /> : null}
                <Key wide icon="backspace-outline" onPress={back} onLong={() => setText('')} />
              </View>

              <View style={[styles.row, { marginTop: spacing.sm }]}>
                <Key grow primary icon="checkmark" label={t('kb.done')} onPress={() => onDone(text)} />
                <Key grow label={t('kb.cancel')} onPress={onCancel} />
              </View>
            </View>
          </View>
        </FocusLayer>
      ) : null}
    </Modal>
  );
}

function Key({
  label,
  icon,
  onPress,
  onLong,
  autoFocus,
  active,
  wide,
  grow,
  primary,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  onLong?: () => void;
  autoFocus?: boolean;
  /** Sticky state (shift / symbols page) shown even without focus. */
  active?: boolean;
  wide?: boolean;
  grow?: boolean;
  primary?: boolean;
}) {
  return (
    <Focusable
      onSelect={onPress}
      onLongSelect={onLong}
      autoFocus={autoFocus}
      style={[styles.key, wide && styles.keyWide, grow && styles.keyGrow, primary && styles.keyPrimary, active && styles.keyActive]}
      focusStyle={styles.keyFocus}
    >
      {(f) => (
        <View style={styles.keyInner}>
          {icon ? <Ionicons name={icon} size={22} color={f || primary ? colors.white : colors.text} /> : null}
          {label ? (
            <Text style={[styles.keyLabel, (f || primary) && { color: colors.white }, active && !f && { color: colors.accent }]}>
              {label}
            </Text>
          ) : null}
        </View>
      )}
    </Focusable>
  );
}

const KEY_H = 54;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,5,10,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 700,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: { color: colors.textMuted, fontSize: font.small, fontWeight: '600' },
  preview: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.borderFocus,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: spacing.sm,
  },
  previewText: { color: colors.text, fontSize: font.h3, minHeight: 30 },
  caret: { color: colors.accent },
  row: { flexDirection: 'row', gap: 8 },
  key: {
    flex: 1,
    height: KEY_H,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyWide: { flex: 1.6 },
  keyGrow: { flex: 4 },
  keyPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  keyActive: { borderColor: colors.accent },
  keyFocus: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
  },
  keyInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyLabel: { color: colors.text, fontSize: 20, fontWeight: '600' },
});
