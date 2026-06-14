import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { BrandMark, Field, PrimaryButton, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import { parseM3U } from '@/lib/m3u';
import { loadXtream, xtreamLogin } from '@/lib/xtream';
import type { SourceConfig } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

type Mode = 'm3u' | 'xtream';

export default function Onboarding() {
  const router = useRouter();
  const addSource = useStore((s) => s.addSource);
  const liveExt = useStore((s) => s.settings.liveExt);

  const [mode, setMode] = useState<Mode>('xtream');
  const [name, setName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [host, setHost] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const id = `src_${Date.now()}`;
      if (mode === 'm3u') {
        if (!m3uUrl.trim()) throw new Error('Inserisci l’URL della lista M3U.');
        const res = await fetch(m3uUrl.trim(), { headers: { 'User-Agent': 'BlackstarPlayer' } });
        if (!res.ok) throw new Error(`Errore caricamento lista (HTTP ${res.status}).`);
        const content = parseM3U(await res.text());
        if (!content.live.length && !content.movies.length && !content.series.length) {
          throw new Error('Nessun canale trovato nella lista.');
        }
        const src: SourceConfig = {
          id,
          type: 'm3u',
          name: name.trim() || 'Lista M3U',
          m3uUrl: m3uUrl.trim(),
          createdAt: Date.now(),
        };
        await addSource(src, content);
      } else {
        if (!host.trim() || !username.trim() || !password.trim()) {
          throw new Error('Compila DNS server, username e password.');
        }
        const src: SourceConfig = {
          id,
          type: 'xtream',
          name: name.trim() || username.trim(),
          host: host.trim(),
          username: username.trim(),
          password: password.trim(),
          createdAt: Date.now(),
        };
        const info = await xtreamLogin(src);
        src.name = name.trim() || info.name;
        const content = await loadXtream(src, liveExt);
        await addSource(src, content);
      }
      router.replace('/(tabs)/home');
    } catch (e: any) {
      setError(e?.message || 'Accesso non riuscito.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <BrandMark size={34} />
        <Txt variant="small" style={{ marginTop: 4, marginBottom: spacing.lg }}>
          Player IPTV — veloce, ottimizzato per la TV. Made in Italy.
        </Txt>

        <View style={styles.tabs}>
          <ModeChip label="Xtream (DNS)" icon="key" active={mode === 'xtream'} onPress={() => setMode('xtream')} />
          <ModeChip label="Lista M3U / URL" icon="link" active={mode === 'm3u'} onPress={() => setMode('m3u')} />
        </View>

        <View style={styles.card}>
          <Field label="Nome profilo (opzionale)" value={name} onChangeText={setName} placeholder="Es. Casa" autoCapitalize="sentences" />

          {mode === 'm3u' ? (
            <Field
              label="URL lista M3U"
              value={m3uUrl}
              onChangeText={setM3uUrl}
              placeholder="http://provider/get.php?...type=m3u_plus"
              keyboardType="url"
            />
          ) : (
            <>
              <Field label="DNS server" value={host} onChangeText={setHost} placeholder="http://dns.server:8080" keyboardType="url" />
              <Field label="Username" value={username} onChangeText={setUsername} placeholder="Il tuo username" />
              <Field label="Password" value={password} onChangeText={setPassword} placeholder="La tua password" secureTextEntry />
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
            <PrimaryButton label={busy ? 'Connessione…' : 'Accedi'} icon="log-in" onPress={busy ? () => {} : submit} autoFocus />
          </View>
        </View>

        <Txt variant="tiny" style={{ marginTop: spacing.lg, maxWidth: 520 }}>
          Blackstar Player non fornisce contenuti né server: usa solo la lista o l’abbonamento che inserisci tu. Nessun
          dato lascia il dispositivo.
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
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
});
