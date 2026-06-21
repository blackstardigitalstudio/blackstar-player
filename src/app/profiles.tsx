import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BrandMark, Field, PrimaryButton, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import type { Profile } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

function Avatar({ profile, onSelect }: { profile: Profile; onSelect: () => void }) {
  return (
    <Focusable onSelect={onSelect} style={styles.avatarWrap} focusStyle={styles.avatarFocus}>
      {(f) => (
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View style={[styles.avatar, { backgroundColor: profile.color }, f && { borderColor: colors.text }]}>
            <Txt variant="display" color={colors.onAccent}>
              {profile.name.trim().charAt(0).toUpperCase()}
            </Txt>
          </View>
          <Txt variant="small" color={f ? colors.text : colors.textMuted} numberOfLines={1}>
            {profile.name}
          </Txt>
        </View>
      )}
    </Focusable>
  );
}

export default function Profiles() {
  const router = useRouter();
  const t = useT();
  const profiles = useStore((s) => s.profiles);
  const setActiveProfile = useStore((s) => s.setActiveProfile);
  const addProfile = useStore((s) => s.addProfile);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const pick = async (id: string) => {
    await setActiveProfile(id);
    router.replace('/(tabs)/home');
  };

  const create = async () => {
    await addProfile(name);
    setName('');
    setAdding(false);
    router.replace('/(tabs)/home');
  };

  return (
    <Screen>
      <View style={styles.wrap}>
        <BrandMark size={30} />
        <Txt variant="h1" style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}>
          {t('prof.who')}
        </Txt>

        <View style={styles.grid}>
          {profiles.map((p) => (
            <Avatar key={p.id} profile={p} onSelect={() => pick(p.id)} />
          ))}
          <Focusable onSelect={() => setAdding(true)} style={styles.avatarWrap} focusStyle={styles.avatarFocus}>
            {(f) => (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={[styles.avatar, styles.addAvatar, f && { borderColor: colors.text }]}>
                  <Ionicons name="add" size={48} color={colors.textMuted} />
                </View>
                <Txt variant="small" color={f ? colors.text : colors.textMuted}>
                  {t('prof.add')}
                </Txt>
              </View>
            )}
          </Focusable>
        </View>

        {adding ? (
          <View style={styles.form}>
            <Field label={t('prof.name')} value={name} onChangeText={setName} placeholder="Es. Marco" autoCapitalize="sentences" />
            <View style={{ marginTop: spacing.sm }}>
              <PrimaryButton label={t('prof.create')} icon="person-add" onPress={create} autoFocus />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.xl, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl, justifyContent: 'center' },
  avatarWrap: { borderRadius: radius.lg, padding: spacing.sm },
  avatarFocus: { backgroundColor: colors.surfaceHi },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  addAvatar: { backgroundColor: colors.surface, borderColor: colors.border, borderStyle: 'dashed' },
  form: { marginTop: spacing.xl, width: '100%', maxWidth: 420 },
});
