import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useT } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme/tokens';
import { PrimaryButton, Txt } from './ui';

// PIN entry with a built-in D-pad numpad — no TextInput and no system IME.
// The Android TV IME + react-native-tvos TextInput focus is broken upstream
// (focus escapes, keyboard won't open): digits are plain Focusables, the one
// primitive that has always worked on the box. Auto-submits at 4 digits.

export function PinModal({
  visible,
  title,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  onSubmit: (pin: string) => boolean | void; // return false to signal wrong pin
  onClose: () => void;
}) {
  const t = useT();
  const [pin, setPin] = useState('');
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (visible) {
      setPin('');
      setErr(false);
    }
  }, [visible]);

  const submit = (value: string) => {
    const ok = onSubmit(value);
    if (ok === false) {
      setErr(true);
      setPin('');
    }
  };

  const press = (d: string) => {
    setErr(false);
    const next = (pin + d).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {visible ? (
      <FocusLayer>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Txt variant="h3" style={{ marginBottom: spacing.md }}>
            {title}
          </Txt>
          <View style={styles.dots}>
            <Text style={styles.dotsText}>{'●'.repeat(pin.length)}{'○'.repeat(4 - pin.length)}</Text>
          </View>
          {err ? (
            <Txt variant="small" color={colors.danger} style={{ marginBottom: spacing.sm }}>
              {t('pin.wrong')}
            </Txt>
          ) : null}
          {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row, ri) => (
            <View key={ri} style={styles.numRow}>
              {row.map((d) => (
                <NumKey key={d} label={d} onPress={() => press(d)} autoFocus={d === '1'} />
              ))}
            </View>
          ))}
          <View style={styles.numRow}>
            <NumKey icon="backspace-outline" onPress={() => setPin((p) => p.slice(0, -1))} />
            <NumKey label="0" onPress={() => press('0')} />
            <NumKey icon="checkmark" primary onPress={() => submit(pin)} />
          </View>
          <View style={styles.row}>
            <Focusable onSelect={onClose} style={styles.cancel} focusStyle={{ borderColor: colors.borderFocus }}>
              {(f) => (
                <Txt variant="body" color={f ? colors.text : colors.textMuted}>
                  {t('pin.cancel')}
                </Txt>
              )}
            </Focusable>
            <PrimaryButton label={t('pin.confirm')} onPress={() => submit(pin)} />
          </View>
        </View>
      </View>
      </FocusLayer>
      ) : null}
    </Modal>
  );
}

function NumKey({
  label,
  icon,
  onPress,
  autoFocus,
  primary,
}: {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  autoFocus?: boolean;
  primary?: boolean;
}) {
  return (
    <Focusable
      onSelect={onPress}
      autoFocus={autoFocus}
      style={[styles.numKey, primary && { backgroundColor: colors.accent, borderColor: colors.accent }]}
      focusStyle={styles.numKeyFocus}
    >
      {(f) => (
        <>
          {icon ? <Ionicons name={icon} size={24} color={f || primary ? colors.white : colors.text} /> : null}
          {label ? <Text style={[styles.numLabel, f && { color: colors.white }]}>{label}</Text> : null}
        </>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  dots: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dotsText: { color: colors.text, fontSize: font.h2, letterSpacing: 12 },
  numRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  numKey: {
    flex: 1,
    height: 56,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numKeyFocus: {
    borderColor: colors.borderFocus,
    borderWidth: 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
  },
  numLabel: { color: colors.text, fontSize: 22, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.md },
  cancel: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
});
