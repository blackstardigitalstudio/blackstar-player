import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BrandMark, Field, GhostButton, PrimaryButton, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { parseM3U } from '@/lib/m3u';
import { loadXtreamFailover } from '@/lib/xtream';
import { useT } from '@/i18n';
import type { SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

type Mode = 'm3u' | 'xtream';
const MAX_DNS = 5;

export default function Onboarding() {
  const router = useRouter();
  const t = useT();
  const addSource = useStore((s) => s.addSource);
  const liveExt = useStore((s) => s.settings.liveExt);

  const [mode, setMode] = useState<Mode>('xtream');
  const [name, setName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [hosts, setHosts] = useState<string[]>(['']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setHostAt = (i: number, val: string) => setHosts((h) => h.map((x, j) => (j === i ? val : x)));
  const addHost = () => setHosts((h) => (h.length < MAX_DNS ? [...h, ''] : h));
  const removeHost = (i: number) => setHosts((h) => h.filter((_, j) => j !== i));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const id = `src_${Date.now()}`;
      if (mode === 'm3u') {
        if (!m3uUrl.trim()) throw new Error(t('ob.errM3uUrl'));
        const res = await fetch(m3uUrl.trim(), { headers: { 'User-Agent': 'BlackstarPlayer' } });
        if (!res.ok) throw new Error(t('ob.errHttp', { code: res.status }));
        const content = parseM3U(await res.text());
        if (!content.live.length && !content.movies.length && !content.series.length) {
          throw new Error(t('ob.errEmpty'));
        }
        const src: SourceConfig = {
          id,
          type: 'm3u',
          name: name.trim() || t('ob.m3uDefault'),
          m3uUrl: m3uUrl.trim(),
          createdAt: Date.now(),
        };
        await addSource(src, content);
      } else {
        const cleanHosts = hosts.map((h) => h.trim()).filter(Boolean);
        if (!cleanHosts.length || !username.trim() || !password.trim()) {
          throw new Error(t('ob.errXtreamFields'));
        }
        const src: SourceConfig = {
          id,
          type: 'xtream',
          name: name.trim() || username.trim(),
          host: cleanHosts[0],
          hosts: cleanHosts,
          username: username.trim(),
          password: password.trim(),
          createdAt: Date.now(),
        };
        // Tries each DNS in order until one authenticates and loads.
        try {
          const { content, host } = await loadXtreamFailover(src, liveExt);
          src.host = host;
          await addSource(src, content);
        } catch {
          throw new Error(t('ob.errGeneric'));
        }
      }
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || t('ob.errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <BrandMark size={34} />
        <Txt variant="small" style={{ marginTop: 4, marginBottom: spacing.lg }}>
          {t('ob.tagline')}
        </Txt>

        <View style={styles.tabs}>
          <ModeChip label={t('ob.xtream')} icon="key" active={mode === 'xtream'} onPress={() => setMode('xtream')} />
          <ModeChip label={t('ob.m3u')} icon="link" active={mode === 'm3u'} onPress={() => setMode('m3u')} />
        </View>

        <View style={styles.card}>
          <Field label={t('ob.profileName')} value={name} onChangeText={setName} placeholder={t('ob.profilePh')} autoCapitalize="sentences" />

          {mode === 'm3u' ? (
            <Field
              label={t('ob.m3uUrl')}
              value={m3uUrl}
              onChangeText={setM3uUrl}
              placeholder="http://provider/get.php?...type=m3u_plus"
              keyboardType="url"
            />
          ) : (
            <>
              <Field label={t('ob.username')} value={username} onChangeText={setUsername} placeholder={t('ob.usernamePh')} />
              <Field label={t('ob.password')} value={password} onChangeText={setPassword} placeholder={t('ob.passwordPh')} secureTextEntry />

              <View style={{ gap: spacing.sm }}>
                <Txt variant="small">{t('ob.dnsTitle')}</Txt>
                {hosts.map((h, i) => (
                  <View key={i} style={styles.dnsRow}>
                    <View style={{ flex: 1 }}>
                      <Field
                        label={i === 0 ? t('ob.dnsMain') : t('ob.dnsAlt', { n: i })}
                        value={h}
                        onChangeText={(val) => setHostAt(i, val)}
                        placeholder="http://dns.server:8080"
                        keyboardType="url"
                      />
                    </View>
                    {i > 0 ? (
                      <Focusable onSelect={() => removeHost(i)} style={styles.del} focusStyle={{ borderColor: colors.borderFocus }}>
                        <Ionicons name="trash" size={18} color={colors.danger} />
                      </Focusable>
                    ) : null}
                  </View>
                ))}
                {hosts.length < MAX_DNS ? (
                  <GhostButton label={t('ob.addDns')} icon="add" onPress={addHost} />
                ) : null}
                <Txt variant="tiny">{t('ob.dnsHint')}</Txt>
              </View>
            </>
          )}

          {error ? (
            <View style={styles.error}>
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Txt variant="small" color={colors.danger} style={{ flex: 1 }}>
                {error}
              </Txt>
            </View>
          ) : null}

          <View style={{ marginTop: spacing.sm }}>
            <PrimaryButton label={busy ? t('ob.connecting') : t('ob.login')} icon="log-in" onPress={busy ? () => {} : submit} autoFocus />
          </View>
        </View>

        <Txt variant="tiny" style={{ marginTop: spacing.lg, maxWidth: 520 }}>
          {t('ob.disclaimer')}
        </Txt>
      </ScrollView>
    </Screen>
  );
}

function ModeChip({ label, icon, active, onPress }: { label: string; icon: any; active: boolean; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} style={[styles.chip, active && styles.chipActive]} focusStyle={styles.chipFocus}>
      {(focused) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Ionicons name={icon} size={18} color={active || focused ? colors.accent : colors.textMuted} />
          <Txt variant="small" color={active || focused ? colors.text : colors.textMuted}>
            {label}
          </Txt>
        </View>
      )}
    </Focusable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  chipFocus: { borderColor: colors.borderFocus },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dnsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  del: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: 0,
  },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
