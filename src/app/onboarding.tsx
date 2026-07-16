import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { BrandMark, Field, GhostButton, PrimaryButton, Screen, Txt } from '@/components/ui';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Focusable } from '@/tv/Focusable';
import { FocusScrollView } from '@/tv/FocusScroll';
import { useStore } from '@/store/useStore';
import { parseM3U } from '@/lib/m3u';
import { fetchTextTimeout, loadXtreamFailover } from '@/lib/xtream';
import { useT } from '@/i18n';
import type { SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

type Mode = 'm3u' | 'xtream';
const MAX_DNS = 5;

export default function Onboarding() {
  const router = useRouter();
  const t = useT();
  const params = useLocalSearchParams<{ sourceId?: string }>();
  const editId = params.sourceId;
  const addSource = useStore((s) => s.addSource);
  const sources = useStore((s) => s.sources);
  const liveExt = useStore((s) => s.settings.liveExt);

  const [mode, setMode] = useState<Mode>('xtream');
  const [name, setName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [hosts, setHosts] = useState<string[]>(['']);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoFocusHost, setAutoFocusHost] = useState<number>(-1);

  // Refs so pressing "next" on the keyboard jumps to the following field.
  const nameRef = useRef<TextInput>(null);
  const m3uRef = useRef<TextInput>(null);
  const userRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const dnsRef = useRef<TextInput>(null);

  // Edit mode: prefill the form from the existing source.
  useEffect(() => {
    if (!editId) return;
    const src = sources.find((s) => s.id === editId);
    if (!src) return;
    setMode(src.type);
    setName(src.name);
    if (src.type === 'm3u') setM3uUrl(src.m3uUrl || '');
    else {
      setHosts(src.hosts && src.hosts.length ? src.hosts : [src.host || '']);
      setUsername(src.username || '');
      setPassword(src.password || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const setHostAt = (i: number, val: string) => setHosts((h) => h.map((x, j) => (j === i ? val : x)));
  const addHost = () => {
    if (hosts.length >= MAX_DNS) return;
    setAutoFocusHost(hosts.length); // focus + open keyboard on the DNS just added
    setHosts((h) => [...h, '']);
  };
  const removeHost = (i: number) => setHosts((h) => h.filter((_, j) => j !== i));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const id = editId || `src_${Date.now()}`;
      const createdAt = sources.find((s) => s.id === id)?.createdAt ?? Date.now();
      if (mode === 'm3u') {
        if (!m3uUrl.trim()) throw new Error(t('ob.errM3uUrl'));
        // Bounded fetch (connect + body) with an IPTV-friendly UA — a slow host
        // can no longer hang first-run onboarding forever.
        const { ok, status, text } = await fetchTextTimeout(m3uUrl.trim(), 15000);
        if (!ok) throw new Error(t('ob.errHttp', { code: status }));
        const content = parseM3U(text);
        if (!content.live.length && !content.movies.length && !content.series.length) {
          throw new Error(t('ob.errEmpty'));
        }
        const src: SourceConfig = {
          id,
          type: 'm3u',
          name: name.trim() || t('ob.m3uDefault'),
          m3uUrl: m3uUrl.trim(),
          createdAt,
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
          createdAt,
        };
        // Tries each DNS in order until one authenticates and loads. Let the
        // real reason (invalid credentials / HTTP error / timeout) surface so the
        // user knows what to fix instead of a vague generic message.
        const { content, host } = await loadXtreamFailover(src, liveExt);
        src.host = host;
        await addSource(src, content);
      }
      if (editId) router.back();
      else router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || t('ob.errGeneric'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <FocusScrollView contentContainerStyle={styles.wrap}>
        {editId ? (
          <View style={{ marginBottom: spacing.md }}>
            <GhostButton label={t('common.back')} icon="arrow-back" onPress={() => router.back()} />
          </View>
        ) : null}
        <BrandMark size={34} />
        <Txt variant="small" style={{ marginTop: 4, marginBottom: spacing.md }}>
          {t('ob.tagline')}
        </Txt>

        {/* Language first: pick Italiano or Español right away (flags = instantly clear). */}
        <View style={{ marginBottom: spacing.lg }}>
          <LanguagePicker />
        </View>

        {/* One plain line so the first choice is obvious, not a blind guess. */}
        <Txt variant="small" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          {t('ob.chooseHint')}
        </Txt>
        <View style={styles.tabs}>
          <ModeChip label={t('ob.xtream')} icon="key" active={mode === 'xtream'} onPress={() => setMode('xtream')} />
          <ModeChip label={t('ob.m3u')} icon="link" active={mode === 'm3u'} onPress={() => setMode('m3u')} />
        </View>

        <View style={styles.kbHint}>
          <Ionicons name="phone-portrait-outline" size={18} color={colors.accent} />
          <Txt variant="tiny" color={colors.textMuted} style={{ flex: 1 }}>
            {t('ob.typeHint')}
          </Txt>
        </View>

        <View style={styles.card}>
          <Field
            label={t('ob.profileName')}
            value={name}
            onChangeText={setName}
            placeholder={t('ob.profilePh')}
            autoCapitalize="sentences"
            inputRef={nameRef}
            onSubmit={() => (mode === 'm3u' ? m3uRef : userRef).current?.focus()}
          />

          {mode === 'm3u' ? (
            <Field
              label={t('ob.m3uUrl')}
              value={m3uUrl}
              onChangeText={setM3uUrl}
              placeholder="http://provider/get.php?...type=m3u_plus"
              keyboardType="url"
              inputRef={m3uRef}
            />
          ) : (
            <>
              <Field label={t('ob.username')} value={username} onChangeText={setUsername} placeholder={t('ob.usernamePh')} inputRef={userRef} onSubmit={() => passRef.current?.focus()} />
              <Field label={t('ob.password')} value={password} onChangeText={setPassword} placeholder={t('ob.passwordPh')} secureTextEntry inputRef={passRef} onSubmit={() => dnsRef.current?.focus()} />

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
                        autoFocus={i === autoFocusHost}
                        inputRef={i === 0 ? dnsRef : undefined}
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
            <PrimaryButton label={busy ? t('ob.connecting') : editId ? t('ob.save') : t('ob.login')} icon={editId ? 'save' : 'log-in'} onPress={busy ? () => {} : submit} autoFocus />
          </View>
        </View>

        <Txt variant="tiny" style={{ marginTop: spacing.lg, maxWidth: 520 }}>
          {t('ob.disclaimer')}
        </Txt>
      </FocusScrollView>
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
  kbHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
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
