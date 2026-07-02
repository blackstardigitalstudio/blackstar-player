import { Ionicons } from '@expo/vector-icons';
import { openBrowserAsync } from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { GhostButton, PrimaryButton, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { FocusScrollView } from '@/tv/FocusScroll';
import { useVpn } from '@/store/useVpn';
import { parseWgConf } from '@/lib/wireguard';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

const FREE_PROVIDERS = [
  { name: 'VPN Jantit', url: 'https://www.vpnjantit.com/free-wireguard' },
  { name: 'OpenTunnel', url: 'https://opentunnel.net/wireguard/' },
  { name: 'FreeVPN.us', url: 'https://www.freevpn.us/wireguard/' },
];

export default function Vpn() {
  const router = useRouter();
  const t = useT();
  const vpn = useVpn();
  const [name, setName] = useState('');
  const [conf, setConf] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const nameRef = useRef<TextInput>(null);
  const confRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!vpn.hydrated) vpn.hydrate();
  }, [vpn.hydrated]);

  const connected = vpn.status === 'CONNECTED';
  const busy = vpn.status === 'CONNECTING' || vpn.status === 'DISCONNECTING';
  const statusColor = connected ? colors.success : busy ? colors.warning : vpn.status === 'ERROR' ? colors.danger : colors.textMuted;
  const statusLabel = connected
    ? t('vpn.connected')
    : vpn.status === 'CONNECTING'
      ? t('vpn.connecting')
      : vpn.status === 'ERROR'
        ? (vpn.error || 'Error')
        : t('vpn.disconnected');

  const save = async () => {
    setErr(null);
    try {
      const parsed = parseWgConf(conf);
      const saved = await vpn.addConfig(name, parsed);
      setName('');
      setConf('');
      vpn.connect(saved.id);
    } catch {
      setErr(t('vpn.parseErr'));
    }
  };

  return (
    <Screen>
      <FocusScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <GhostButton label={t('common.back')} icon="arrow-back" onPress={() => router.back()} />
          <Txt variant="h2">{t('vpn.title')}</Txt>
        </View>
        <Txt variant="small" style={{ marginBottom: spacing.lg }}>
          {t('vpn.subtitle')}
        </Txt>

        {/* Status card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name={connected ? 'shield-checkmark' : 'shield-outline'} size={34} color={statusColor} />
            <View style={{ flex: 1 }}>
              <Txt variant="h3" color={statusColor}>
                {statusLabel}
              </Txt>
              <Txt variant="tiny">
                {t('vpn.server', { host: connected ? (vpn.configs.find((c) => c.id === vpn.activeId)?.config.serverAddress || '—') : '—' })}
              </Txt>
            </View>
            {connected ? (
              <PrimaryButton label={t('vpn.disconnect')} icon="power" onPress={() => vpn.disconnect()} />
            ) : null}
          </View>
          {!vpn.supported ? (
            <Txt variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>
              {t('vpn.notSupported')}
            </Txt>
          ) : null}
        </View>

        {/* Saved configs */}
        <Txt variant="small" color={colors.accent} style={styles.sectionTitle}>
          {t('vpn.myConfigs')}
        </Txt>
        {vpn.configs.length === 0 ? (
          <Txt variant="small" style={{ marginBottom: spacing.md }}>
            {t('vpn.noConfigs')}
          </Txt>
        ) : (
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            {vpn.configs.map((c) => {
              const active = vpn.activeId === c.id && connected;
              return (
                <View key={c.id} style={styles.row}>
                  <Focusable onSelect={() => vpn.connect(c.id)} style={styles.rowMain} focusStyle={styles.rowFocus}>
                    {(f) => (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                        <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.success : f ? colors.accent : colors.textMuted} />
                        <View style={{ flex: 1 }}>
                          <Txt variant="body" numberOfLines={1}>
                            {c.name}
                          </Txt>
                          <Txt variant="tiny">{c.config.serverAddress}:{c.config.serverPort}</Txt>
                        </View>
                        <Txt variant="small" color={active ? colors.success : colors.accent}>
                          {active ? t('vpn.connected') : t('vpn.connect')}
                        </Txt>
                      </View>
                    )}
                  </Focusable>
                  <Focusable onSelect={() => vpn.removeConfig(c.id)} style={styles.del} focusStyle={{ borderColor: colors.borderFocus }}>
                    <Ionicons name="trash" size={18} color={colors.danger} />
                  </Focusable>
                </View>
              );
            })}
          </View>
        )}

        {/* Import */}
        <Txt variant="small" color={colors.accent} style={styles.sectionTitle}>
          {t('vpn.import')}
        </Txt>
        <View style={{ gap: spacing.sm }}>
          <Focusable onSelect={() => nameRef.current?.focus()} onFocus={() => nameRef.current?.focus()} focusStyle={{}}>
            {(ring) => (
              <TextInput
                ref={nameRef}
                value={name}
                onChangeText={setName}
                placeholder={t('vpn.nameOpt')}
                placeholderTextColor={colors.textFaint}
                style={[styles.input, ring && { borderColor: colors.borderFocus }]}
              />
            )}
          </Focusable>
          <Focusable onSelect={() => confRef.current?.focus()} onFocus={() => confRef.current?.focus()} focusStyle={{}}>
            {(ring) => (
              <TextInput
                ref={confRef}
                value={conf}
                onChangeText={setConf}
                placeholder={t('vpn.paste')}
                placeholderTextColor={colors.textFaint}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                style={[styles.input, styles.textarea, ring && { borderColor: colors.borderFocus }]}
              />
            )}
          </Focusable>
          {err ? (
            <Txt variant="small" color={colors.danger}>
              {err}
            </Txt>
          ) : null}
          <PrimaryButton label={t('vpn.saveConfig')} icon="cloud-upload" onPress={save} />
        </View>

        {/* Free providers */}
        <Txt variant="small" color={colors.accent} style={styles.sectionTitle}>
          {t('vpn.free')}
        </Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {FREE_PROVIDERS.map((p) => (
            <GhostButton key={p.url} label={p.name} icon="open-outline" onPress={() => openBrowserAsync(p.url)} />
          ))}
        </View>
        <Txt variant="tiny" style={{ marginTop: spacing.sm }}>
          {t('vpn.freeNote')}
        </Txt>
      </FocusScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgElevated, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  sectionTitle: { textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm },
  rowMain: { flex: 1, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, justifyContent: 'center' },
  rowFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  del: { width: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  textarea: { minHeight: 140, textAlignVertical: 'top', fontFamily: 'monospace' },
});
