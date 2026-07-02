import { useEffect, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useT } from '@/i18n';
import { colors, font, radius, spacing } from '@/theme/tokens';
import { PrimaryButton, Txt } from './ui';

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

  const submit = () => {
    const ok = onSubmit(pin);
    if (ok === false) {
      setErr(true);
      setPin('');
    }
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
          <TextInput
            value={pin}
            onChangeText={(v) => {
              setErr(false);
              setPin(v.replace(/\D/g, '').slice(0, 4));
            }}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
            autoFocus
            placeholder="••••"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            onSubmitEditing={submit}
          />
          {err ? (
            <Txt variant="small" color={colors.danger} style={{ marginTop: 8 }}>
              {t('pin.wrong')}
            </Txt>
          ) : null}
          <View style={styles.row}>
            <Focusable onSelect={onClose} style={styles.cancel} focusStyle={{ borderColor: colors.borderFocus }}>
              {(f) => (
                <Txt variant="body" color={f ? colors.text : colors.textMuted}>
                  {t('pin.cancel')}
                </Txt>
              )}
            </Focusable>
            <PrimaryButton label={t('pin.confirm')} onPress={submit} autoFocus />
          </View>
        </View>
      </View>
      </FocusLayer>
      ) : null}
    </Modal>
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
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: font.h2,
    letterSpacing: 12,
    textAlign: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  cancel: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
});
