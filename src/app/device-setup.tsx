import { Ionicons } from '@expo/vector-icons';
import { reloadAppAsync } from 'expo';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { BrandMark, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { writeDeviceMode, type DeviceMode } from '@/lib/deviceMode';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

function Choice({ icon, label, color, onPress, autoFocus }: { icon: any; label: string; color: string; onPress: () => void; autoFocus?: boolean }) {
  return (
    <Focusable onSelect={onPress} autoFocus={autoFocus} style={styles.card} focusStyle={styles.cardFocus}>
      {(f) => (
        <View style={[styles.cardInner, f && { borderColor: color }]}>
          <Ionicons name={icon} size={56} color={color} />
          <Txt variant="h2">{label}</Txt>
        </View>
      )}
    </Focusable>
  );
}

export default function DeviceSetup() {
  const router = useRouter();
  const t = useT();

  const pick = async (mode: DeviceMode) => {
    writeDeviceMode(mode);
    // Reload so the new sizing/scale applies immediately.
    try {
      await reloadAppAsync();
    } catch {
      router.replace('/');
    }
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <BrandMark size={32} />
        <Txt variant="h1" style={{ marginTop: spacing.lg }}>
          {t('dev.title')}
        </Txt>
        <Txt variant="small" style={{ marginTop: 6, marginBottom: spacing.xl, textAlign: 'center', maxWidth: 460 }}>
          {t('dev.hint')}
        </Txt>
        <View style={styles.row}>
          <Choice icon="tv" label={t('dev.tv')} color={colors.live} onPress={() => pick('tv')} autoFocus />
          <Choice icon="phone-portrait" label={t('dev.phone')} color={colors.accent} onPress={() => pick('phone')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
  card: { borderRadius: radius.lg },
  cardFocus: {},
  cardInner: {
    width: 200,
    height: 200,
    borderRadius: radius.lg,
    backgroundColor: colors.bgElevated,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
});
