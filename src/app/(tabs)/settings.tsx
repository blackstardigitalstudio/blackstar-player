import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { PinModal } from '@/components/PinModal';
import { Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { FocusScrollView } from '@/tv/FocusScroll';
import { useStore, type PlayerMode } from '@/store/useStore';
import { openCastSettings } from '@/lib/cast';
import { requestUpdateCheck } from '@/lib/updater';
import { APP_VERSION } from '@/lib/version';
import { useT } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';

function Row({
  icon,
  label,
  value,
  danger,
  onPress,
}: {
  icon: any;
  label: string;
  value?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Focusable onSelect={onPress} style={styles.row} focusStyle={styles.rowFocus}>
      {(f) => (
        <View style={styles.rowInner}>
          <Ionicons name={icon} size={20} color={danger ? colors.danger : f ? colors.accent : colors.textMuted} />
          <Txt variant="body" color={danger ? colors.danger : colors.text} style={{ flex: 1 }}>
            {label}
          </Txt>
          {value ? (
            <Txt variant="small" color={f ? colors.text : colors.textMuted}>
              {value}
            </Txt>
          ) : (
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          )}
        </View>
      )}
    </Focusable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="small" color={colors.accent} style={{ marginLeft: spacing.lg, marginBottom: 6, textTransform: 'uppercase' }}>
        {title}
      </Txt>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const PLAYER_ORDER: PlayerMode[] = ['internal', 'ask', 'mxplayer', 'vlc'];

export default function Settings() {
  const router = useRouter();
  const t = useT();
  const s = useStore();
  const active = s.sources.find((x) => x.id === s.activeId);

  const [pinMode, setPinMode] = useState<null | 'disable' | 'unlock' | 'setnew' | 'enableset' | 'changeold'>(null);
  const pinTitle = pinMode === 'setnew' || pinMode === 'enableset' ? t('pin.set') : t('pin.enter');

  const handlePin = (pin: string): boolean | void => {
    if (pinMode === 'disable') {
      if (pin !== s.settings.pin) return false;
      s.updateSettings({ parentalEnabled: false });
      s.setUnlocked(false);
    } else if (pinMode === 'unlock') {
      if (pin !== s.settings.pin) return false;
      s.setUnlocked(true);
    } else if (pinMode === 'changeold') {
      // Must prove the CURRENT pin before choosing a new one (no silent bypass).
      if (pin !== s.settings.pin) return false;
      setPinMode('setnew');
      return; // keep the modal open for the new pin
    } else if (pinMode === 'setnew') {
      if (pin.length < 4) return false;
      s.updateSettings({ pin });
    } else if (pinMode === 'enableset') {
      if (pin.length < 4) return false;
      s.updateSettings({ pin, parentalEnabled: true });
      s.setUnlocked(false);
    }
    setPinMode(null);
  };

  const toggleParental = () => {
    if (s.settings.parentalEnabled) setPinMode('disable');
    else if (s.settings.pin) {
      s.updateSettings({ parentalEnabled: true });
      s.setUnlocked(false);
    } else setPinMode('enableset');
  };

  const castToTv = async () => {
    const ok = await openCastSettings();
    if (!ok) Alert.alert('Blackstar Player', t('cast.notSupported'));
  };

  // Confirm before any irreversible action (a single accidental OK on the remote
  // must not wipe a list/profile/history).
  const confirm = (message: string, onYes: () => void) =>
    Alert.alert('Blackstar Player', message, [
      { text: t('pin.cancel'), style: 'cancel' },
      { text: t('common.remove'), style: 'destructive', onPress: onYes },
    ]);

  const aspectLabel = { contain: t('set.aspectContain'), cover: t('set.aspectCover'), fill: t('set.aspectFill') }[s.settings.aspectMode];
  const playerLabel = (m: PlayerMode) =>
    m === 'internal' ? t('player.internal') : m === 'ask' ? t('player.ask') : m === 'mxplayer' ? 'MX Player' : 'VLC';
  const nextPlayer = () => {
    const i = PLAYER_ORDER.indexOf(s.settings.playerMode);
    return PLAYER_ORDER[(i + 1) % PLAYER_ORDER.length];
  };

  return (
    <>
    <FocusScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <Txt variant="h2" style={{ marginBottom: spacing.md }}>
        {t('set.title')}
      </Txt>

      <Section title={t('set.secUsers')}>
        <Row
          icon="people"
          label={t('set.switchProfile')}
          value={s.profiles.find((p) => p.id === s.activeProfileId)?.name}
          onPress={() => router.push('/profiles')}
        />
        {s.profiles.length > 1 && s.activeProfileId ? (
          <Row
            icon="person-remove"
            label={t('set.removeProfileUser', { name: s.profiles.find((p) => p.id === s.activeProfileId)?.name || '' })}
            danger
            onPress={() => confirm(t('confirm.removeProfile'), () => s.removeProfile(s.activeProfileId!))}
          />
        ) : null}
      </Section>

      <Section title={t('set.secSources')}>
        {s.sources.map((src) => (
          <View key={src.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Row
                icon={src.id === s.activeId ? 'radio-button-on' : 'radio-button-off'}
                label={`${src.name}  ·  ${src.type === 'xtream' ? 'Xtream' : 'M3U'}`}
                value={src.id === s.activeId ? t('set.active') : t('set.activate')}
                onPress={() => s.setActive(src.id)}
              />
            </View>
            <Focusable onSelect={() => router.push({ pathname: '/onboarding', params: { sourceId: src.id } })} style={styles.editBtn} focusStyle={styles.rowFocus}>
              {(f) => <Ionicons name="create-outline" size={20} color={f ? colors.accent : colors.textMuted} />}
            </Focusable>
          </View>
        ))}
        <Row icon="add-circle" label={t('set.addProfile')} onPress={() => router.push('/onboarding')} />
        {active ? (
          <Row icon="create" label={t('set.editSource')} onPress={() => router.push({ pathname: '/onboarding', params: { sourceId: active.id } })} />
        ) : null}
        {active ? (
          <Row icon="trash" label={t('set.removeProfile', { name: active.name })} danger onPress={() => confirm(t('confirm.removeSource'), () => s.removeSource(active.id))} />
        ) : null}
      </Section>

      <Section title={t('set.secList')}>
        <Row icon="refresh" label={t('set.refreshNow')} onPress={() => s.refresh(true)} />
        <Row
          icon="time"
          label={t('set.autoUpdate')}
          value={`${s.settings.autoCleanupHours} h`}
          onPress={() => s.updateSettings({ autoCleanupHours: s.settings.autoCleanupHours >= 24 ? 3 : s.settings.autoCleanupHours + 3 })}
        />
        <Row icon="trash-bin" label={t('set.clearCache')} onPress={() => confirm(t('confirm.clearCache'), () => s.clearCache())} />
      </Section>

      <Section title={t('set.secPlayback')}>
        <Row icon="play-circle" label={t('set.player')} value={playerLabel(s.settings.playerMode)} onPress={() => s.updateSettings({ playerMode: nextPlayer() })} />
        <Row
          icon="resize"
          label={t('set.aspect')}
          value={aspectLabel}
          onPress={() =>
            s.updateSettings({
              aspectMode: s.settings.aspectMode === 'contain' ? 'cover' : s.settings.aspectMode === 'cover' ? 'fill' : 'contain',
            })
          }
        />
        <Row
          icon="cellular"
          label={t('set.liveFormat')}
          value={s.settings.liveExt.toUpperCase()}
          onPress={() => s.updateSettings({ liveExt: s.settings.liveExt === 'ts' ? 'm3u8' : 'ts' })}
        />
        <Row
          icon="shield-checkmark"
          label={t('set.survival')}
          value={s.settings.survivalMode ? t('common.on') : t('common.off')}
          onPress={() => s.updateSettings({ survivalMode: !s.settings.survivalMode })}
        />
        <Row
          icon="play-skip-forward"
          label={t('set.autostart')}
          value={s.settings.autoStartLastChannel ? t('common.on') : t('common.off')}
          onPress={() => s.updateSettings({ autoStartLastChannel: !s.settings.autoStartLastChannel })}
        />
      </Section>

      <Section title={t('set.secInterface')}>
        <Row
          icon="language"
          label={t('set.language')}
          value={s.settings.language === 'it' ? 'Italiano' : 'Español'}
          onPress={() => s.updateSettings({ language: s.settings.language === 'it' ? 'es' : 'it' })}
        />
        <Row
          icon="swap-vertical"
          label={t('set.catOrder')}
          value={t(`cat.${s.settings.categoryOrder === 'mostWatched' ? 'mostWatched' : s.settings.categoryOrder}`)}
          onPress={() => router.push('/categories')}
        />
        <Row
          icon="exit"
          label={t('set.confirmExit')}
          value={s.settings.confirmExit ? t('common.on') : t('common.off')}
          onPress={() => s.updateSettings({ confirmExit: !s.settings.confirmExit })}
        />
      </Section>

      <Section title={t('set.secParental')}>
        <Row
          icon="lock-closed"
          label={t('set.parental')}
          value={s.settings.parentalEnabled ? t('common.on') : t('common.off')}
          onPress={toggleParental}
        />
        {s.settings.parentalEnabled && !s.unlocked ? (
          <Row icon="lock-open" label={t('set.unlock')} onPress={() => setPinMode('unlock')} />
        ) : null}
        {s.settings.parentalEnabled ? (
          <Row icon="key" label={t('set.changePin')} onPress={() => setPinMode(s.settings.pin ? 'changeold' : 'setnew')} />
        ) : null}
      </Section>

      <Section title={t('set.secCast')}>
        <Row icon="tv" label={t('set.castToTv')} onPress={castToTv} />
        <View style={{ padding: spacing.md, paddingTop: 0 }}>
          <Txt variant="tiny">{t('set.castHint')}</Txt>
        </View>
      </Section>

      <Section title={t('set.secVpn')}>
        <Row icon="shield-half" label={t('set.vpnOpen')} onPress={() => router.push('/vpn')} />
      </Section>

      <Section title={t('set.secHistory')}>
        <Row icon="play-skip-forward" label={t('set.clearContinue', { n: Object.keys(s.progress).length })} danger onPress={() => confirm(t('confirm.clearContinue'), () => s.clearProgress())} />
        <Row icon="time-outline" label={t('set.clearHistory', { n: s.recents.length })} danger onPress={() => confirm(t('confirm.clearHistory'), () => s.clearRecents())} />
      </Section>

      <Section title={t('set.secInfo')}>
        <Row icon="cloud-download" label={t('set.checkUpdate')} value={`v${APP_VERSION}`} onPress={() => requestUpdateCheck()} />
        <View style={{ padding: spacing.md }}>
          <Txt variant="tiny">{t('set.infoText')}</Txt>
        </View>
      </Section>
    </FocusScrollView>
    <PinModal visible={pinMode !== null} title={pinTitle} onSubmit={handlePin} onClose={() => setPinMode(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { borderRadius: radius.md, marginHorizontal: 6, marginVertical: 2, borderWidth: 2, borderColor: 'transparent' },
  rowFocus: { backgroundColor: colors.surfaceHi, borderColor: colors.borderFocus },
  editBtn: { padding: 12, borderRadius: radius.md, marginRight: 6, borderWidth: 2, borderColor: 'transparent' },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.md },
});
