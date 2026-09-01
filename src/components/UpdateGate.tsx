import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusLayer } from '@/tv/RemoteProvider';
import { useT } from '@/i18n';
import { checkForUpdate, downloadAndInstall, openInstallPermission, setUpdateTrigger, type UpdateInfo } from '@/lib/updater';
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
  // Shown while a MANUAL "Cerca aggiornamenti" is checking, so the button gives
  // immediate visible feedback instead of doing nothing for up to 8 seconds.
  const [checkingUi, setCheckingUi] = useState(false);
  // Result of a manual check when there is nothing to install. Android's system
  // Alert was used here before, and on a TV it is the wrong tool: it is a native
  // dialog outside the app's FocusLayer, so on a box it could show up with no
  // D-pad focus at all — pressing "Cerca aggiornamenti" looked like it did
  // nothing. Every popup in this app is its own modal (box-app-rules R8).
  const [notice, setNotice] = useState<string | null>(null);
  const checking = useRef(false);
  // A box is left switched on for days, so a check that only ran at startup meant
  // the update simply never showed up until someone rebooted it.
  const lastAuto = useRef(0);
  // Version the user answered "Più tardi" to: don't re-offer it by itself in this
  // session (a manual check still shows it). Asking again every hour is nagging.
  const snoozed = useRef<string | null>(null);
  // Never throw a dialog over someone's film. A postponed automatic check simply
  // runs at the next tick, once they are back out of the player.
  const pathname = usePathname();
  const watching = useRef(false);
  watching.current = pathname.includes('player');

  const run = async (manual: boolean) => {
    if (checking.current) return;
    if (!manual && watching.current) return; // ask again when the video is over
    checking.current = true;
    if (manual) setCheckingUi(true);
    try {
      if (!manual) lastAuto.current = Date.now();
      const u = await checkForUpdate();
      if (manual) setCheckingUi(false);
      if (u && !manual && snoozed.current === u.version) {
        // already declined this exact version in this session
      } else if (u) {
        setError(null);
        setBusy(false);
        setProgress(0);
        setInfo(u);
      } else if (manual) {
        setNotice(t('upd.upToDate'));
      }
    } catch {
      // Only surface a failure on a manual check; the silent startup check stays quiet.
      if (manual) setNotice(t('upd.checkFailed'));
    } finally {
      checking.current = false;
      setCheckingUi(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => run(false), 2500); // don't fight the first render
    setUpdateTrigger(() => run(true));

    // Keep looking while the app stays open, and again whenever it comes back to
    // the foreground — throttled, so we never hammer GitHub.
    const MIN_GAP = 60 * 60 * 1000; // 1h
    const maybe = () => {
      if (Date.now() - lastAuto.current >= MIN_GAP) run(false);
    };
    const every = setInterval(maybe, 30 * 60 * 1000);
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') maybe();
    });

    return () => {
      clearTimeout(timer);
      clearInterval(every);
      sub.remove();
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

  // "Cerca aggiornamenti" is checking → show a spinner overlay so the button
  // clearly did something (the network check can take a few seconds).
  if (!info && checkingUi) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.backdrop}>
          <View style={[styles.card, { alignItems: 'center', gap: spacing.md }]}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Txt variant="body">{t('upd.checking')}</Txt>
          </View>
        </View>
      </Modal>
    );
  }

  // Manual check finished with nothing to install (or it failed) → say so, with
  // a button the remote can actually reach.
  if (!info && notice) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={() => setNotice(null)}>
        <FocusLayer>
          <View style={styles.backdrop}>
            <View style={styles.card}>
              <Txt variant="h3">{t('set.checkUpdate')}</Txt>
              <Txt variant="small" color={colors.textMuted} style={{ marginTop: 6 }}>
                {notice}
              </Txt>
              <View style={styles.row}>
                <PrimaryButton label={t('common.ok')} icon="checkmark" onPress={() => setNotice(null)} autoFocus />
              </View>
            </View>
          </View>
        </FocusLayer>
      </Modal>
    );
  }

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
            <>
              <Txt variant="small" color={colors.danger} style={{ marginTop: spacing.sm }}>
                {error}
              </Txt>
              <Txt variant="tiny" color={colors.textMuted} style={{ marginTop: 6 }}>
                {t('upd.allowHint')}
              </Txt>
              <View style={{ marginTop: spacing.sm, alignItems: 'flex-start' }}>
                <Focusable onSelect={() => openInstallPermission()} style={styles.later} focusStyle={{ borderColor: colors.borderFocus }}>
                  {(f) => (
                    <Txt variant="small" color={f ? colors.text : colors.accent}>
                      {t('upd.allowInstall')}
                    </Txt>
                  )}
                </Focusable>
              </View>
            </>
          ) : null}

          {!busy ? (
            <View style={styles.row}>
              <Focusable
                onSelect={() => {
                  snoozed.current = info.version;
                  setInfo(null);
                }}
                style={styles.later}
                focusStyle={{ borderColor: colors.borderFocus }}
              >
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
