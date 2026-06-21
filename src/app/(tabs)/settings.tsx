import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore, type PlayerMode } from '@/store/useStore';
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

  const aspectLabel = { contain: t('set.aspectContain'), cover: t('set.aspectCover'), fill: t('set.aspectFill') }[s.settings.aspectMode];
  const playerLabel = (m: PlayerMode) =>
    m === 'internal' ? t('player.internal') : m === 'ask' ? t('player.ask') : m === 'mxplayer' ? 'MX Player' : 'VLC';
  const nextPlayer = () => {
    const i = PLAYER_ORDER.indexOf(s.settings.playerMode);
    return PLAYER_ORDER[(i + 1) % PLAYER_ORDER.length];
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <Txt variant="h2" style={{ marginBottom: spacing.md }}>
        {t('set.title')}
      </Txt>

      <Section title={t('set.secProfiles')}>
        {s.sources.map((src) => (
          <Row
            key={src.id}
            icon={src.id === s.activeId ? 'radio-button-on' : 'radio-button-off'}
            label={`${src.name}  ·  ${src.type === 'xtream' ? 'Xtream' : 'M3U'}`}
            value={src.id === s.activeId ? t('set.active') : t('set.activate')}
            onPress={() => s.setActive(src.id)}
          />
        ))}
        <Row icon="add-circle" label={t('set.addProfile')} onPress={() => router.push('/onboarding')} />
        {active ? (
          <Row icon="trash" label={t('set.removeProfile', { name: active.name })} danger onPress={() => s.removeSource(active.id)} />
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
        <Row icon="trash-bin" label={t('set.clearCache')} onPress={() => s.clearCache()} />
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
          icon="keypad"
          label={t('set.showNumbers')}
          value={s.settings.showChannelNumbers ? t('common.on') : t('common.off')}
          onPress={() => s.updateSettings({ showChannelNumbers: !s.settings.showChannelNumbers })}
        />
        <Row
          icon="exit"
          label={t('set.confirmExit')}
          value={s.settings.confirmExit ? t('common.on') : t('common.off')}
          onPress={() => s.updateSettings({ confirmExit: !s.settings.confirmExit })}
        />
      </Section>

      <Section title={t('set.secHistory')}>
        <Row icon="play-skip-forward" label={t('set.clearContinue', { n: Object.keys(s.progress).length })} danger onPress={() => s.clearProgress()} />
        <Row icon="time-outline" label={t('set.clearHistory', { n: s.recents.length })} danger onPress={() => s.clearRecents()} />
      </Section>

      <Section title={t('set.secInfo')}>
        <Row icon="star" label="Blackstar Player" value="v1.0.0" onPress={() => {}} />
        <View style={{ padding: spacing.md }}>
          <Txt variant="tiny">{t('set.infoText')}</Txt>
        </View>
      </Section>
    </ScrollView>
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
  row: { borderRadius: radius.md, marginHorizontal: 6, marginVertical: 2 },
  rowFocus: { backgroundColor: colors.surfaceHi },
  rowInner: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.md },
});
