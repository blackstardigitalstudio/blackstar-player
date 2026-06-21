import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
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

const ASPECT_LABEL: Record<string, string> = { contain: 'Adatta', cover: 'Riempi', fill: 'Estendi' };

export default function Settings() {
  const router = useRouter();
  const s = useStore();
  const active = s.sources.find((x) => x.id === s.activeId);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
      <Txt variant="h2" style={{ marginBottom: spacing.md }}>
        Impostazioni
      </Txt>

      <Section title="Profili">
        {s.sources.map((src) => (
          <Row
            key={src.id}
            icon={src.id === s.activeId ? 'radio-button-on' : 'radio-button-off'}
            label={`${src.name}  ·  ${src.type === 'xtream' ? 'Xtream' : 'M3U'}`}
            value={src.id === s.activeId ? 'Attivo' : 'Attiva'}
            onPress={() => s.setActive(src.id)}
          />
        ))}
        <Row icon="add-circle" label="Aggiungi profilo / playlist" onPress={() => router.push('/onboarding')} />
        {active ? (
          <Row icon="trash" label={`Rimuovi “${active.name}”`} danger onPress={() => s.removeSource(active.id)} />
        ) : null}
      </Section>

      <Section title="Lista">
        <Row icon="refresh" label="Aggiorna lista ora" onPress={() => s.refresh(true)} />
        <Row icon="time" label="Aggiornamento automatico" value={`${s.settings.autoCleanupHours} h`} onPress={() => s.updateSettings({ autoCleanupHours: s.settings.autoCleanupHours >= 24 ? 3 : s.settings.autoCleanupHours + 3 })} />
        <Row icon="trash-bin" label="Svuota cache contenuti" onPress={() => s.clearCache()} />
      </Section>

      <Section title="Riproduzione">
        <Row
          icon="resize"
          label="Formato immagine"
          value={ASPECT_LABEL[s.settings.aspectMode]}
          onPress={() =>
            s.updateSettings({
              aspectMode: s.settings.aspectMode === 'contain' ? 'cover' : s.settings.aspectMode === 'cover' ? 'fill' : 'contain',
            })
          }
        />
        <Row
          icon="cellular"
          label="Formato stream Live"
          value={s.settings.liveExt.toUpperCase()}
          onPress={() => s.updateSettings({ liveExt: s.settings.liveExt === 'ts' ? 'm3u8' : 'ts' })}
        />
        <Row
          icon="shield-checkmark"
          label="Modalità sopravvivenza (auto-retry)"
          value={s.settings.survivalMode ? 'ON' : 'OFF'}
          onPress={() => s.updateSettings({ survivalMode: !s.settings.survivalMode })}
        />
        <Row
          icon="play-skip-forward"
          label="Avvia ultimo canale all’apertura"
          value={s.settings.autoStartLastChannel ? 'ON' : 'OFF'}
          onPress={() => s.updateSettings({ autoStartLastChannel: !s.settings.autoStartLastChannel })}
        />
      </Section>

      <Section title="Interfaccia">
        <Row
          icon="keypad"
          label="Mostra numeri canale (zapping)"
          value={s.settings.showChannelNumbers ? 'ON' : 'OFF'}
          onPress={() => s.updateSettings({ showChannelNumbers: !s.settings.showChannelNumbers })}
        />
        <Row
          icon="exit"
          label="Conferma prima di uscire"
          value={s.settings.confirmExit ? 'ON' : 'OFF'}
          onPress={() => s.updateSettings({ confirmExit: !s.settings.confirmExit })}
        />
      </Section>

      <Section title="Cronologia">
        <Row
          icon="play-skip-forward"
          label={`Svuota “Continua a guardare” (${Object.keys(s.progress).length})`}
          danger
          onPress={() => s.clearProgress()}
        />
        <Row icon="time-outline" label={`Cancella cronologia (${s.recents.length})`} danger onPress={() => s.clearRecents()} />
      </Section>

      <Section title="Info">
        <Row icon="star" label="Blackstar Player" value="v1.0.0" onPress={() => {}} />
        <View style={{ padding: spacing.md }}>
          <Txt variant="tiny">
            Blackstar Digital Studio · Made in Italy 🇮🇹{'\n'}Nessun server esterno, nessun account, nessuna pubblicità.
          </Txt>
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
