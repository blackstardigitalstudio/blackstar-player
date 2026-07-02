import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useT } from '@/i18n';
import { checkForUpdate, downloadAndInstall, setUpdateTrigger, type UpdateInfo } from '@/lib/updater';
import { colors, radius, spacing } from '@/theme/tokens';
import { PrimaryButton, Txt } from './ui';

/**
 * Checks the user's GitHub Releases for a newer APK on startup and offers a
 * one-tap update (download + system installer). Also exposes a manual check
 * triggered from Settings. Mounted once, inside RemoteProvider so D-pad works.
 */
export function UpdateGate() {
  const t = useT();
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);

  const run = async (manual: boolean) => {
    if (checking.current) return;
    checking.current = true;
    try {
      const u = await checkForUpdate();
      if (u) {
        setError(null);
        setBusy(false);
        setProgress(0);
        setInfo(u);
      } else if (manual) {
        Alert.alert('Blackstar Player', t('upd.upToDate'));
      }
    } catch {
      // Only surface a failure on a manual check; the silent startup check stays quiet.
      if (manual) Alert.alert('Blackstar Player', t('upd.checkFailed'));
    } finally {
      checking.current = false;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => run(false), 2500); // don't fight the first render
    setUpdateTrigger(() => run(true));
    return () => {
      clearTimeout(timer);
      setUpdateTrigger(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const install = async () => {
    if (!info) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      await downloadAndInstall(info, setProgress);
    } catch {
      setError(t('upd.error'));
    } finally {
      // Re-enable the buttons whether the OS installer installed, was cancelled,
      // or the download failed — never leave the modal frozen with no way out.
      setBusy(false);
    }
  };

  if (!info) return null;
  const pct = Math.round(progress * 100);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => !busy && setInfo(null)}>
      <FocusLayer>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Txt variant="h3">{t('upd.title')}</Txt>
          <Txt variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>
            {t('upd.available', { v: info.version })}
          </Txt>
          {info.notes ? (
            <Txt variant="small" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
              {info.notes}
            </Txt>
          ) : null}
          {!busy ? (
            <Txt variant="tiny" color={colors.textFaint} style={{ marginTop: spacing.sm }}>
              {t('upd.installHint')}
            </Txt>
          ) : null}

          {busy ? (
            <View style={{ marginTop: spacing.lg }}>
              <Txt variant="small" color={colors.textMuted}>
                {t('upd.downloading')} {pct}%
              </Txt>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${pct}%` }]} />
              </View>
            </View>
          ) : null}

          {error ? (
            <Txt variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>
              {error}
            </Txt>
          ) : null}

          {!busy ? (
            <View style={styles.row}>
              <Focusable onSelect={() => setInfo(null)} style={styles.later} focusStyle={{ borderColor: colors.borderFocus }}>
                {(f) => (
                  <Txt variant="body" color={f ? colors.text : colors.textMuted}>
                    {t('upd.later')}
                  </Txt>
                )}
              </Focusable>
              <PrimaryButton label={error ? t('upd.retry') : t('upd.install')} icon="download-outline" onPress={install} autoFocus />
            </View>
          ) : null}
        </View>
      </View>
      </FocusLayer>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.surface, marginTop: spacing.sm, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.accent },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, marginTop: spacing.lg },
  later: { paddingVertical: 12, paddingHorizontal: spacing.lg, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
});
