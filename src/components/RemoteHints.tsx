import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useT } from '@/i18n';
import { colors, spacing } from '@/theme/tokens';
import { Txt } from './ui';

/**
 * The strip along the bottom that says what the remote does HERE — the one idea
 * every good set-top box app (Duplex, TiviMate) shares, and the reason nobody
 * needs a manual for them: the keys are written on the screen, next to the thing
 * they act on.
 *
 * Deliberately NOT focusable: it is a legend, never a place the D-pad can land.
 * Made in Italy.
 */

type Hint = { icon: any; label: string };

function hintsFor(pathname: string, t: (k: string) => string): Hint[] {
  const move: Hint = { icon: 'move', label: t('hint.move') };
  const back: Hint = { icon: 'arrow-undo', label: t('hint.back') };
  if (pathname.includes('settings')) return [move, { icon: 'ellipse', label: t('hint.change') }, back];
  if (pathname.includes('home')) return [move, { icon: 'ellipse', label: t('hint.open') }, { icon: 'keypad', label: t('hint.zap') }];
  return [move, { icon: 'ellipse', label: t('hint.open') }, back];
}

function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Tick on the minute boundary, not every second: a seconds clock would wake
    // the JS thread 60 times a minute for nothing on a box.
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const d = new Date();
      timer = setTimeout(() => {
        setNow(new Date());
        schedule();
      }, (60 - d.getSeconds()) * 1000);
    };
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function RemoteHints({ pathname }: { pathname: string }) {
  const t = useT();
  const clock = useClock();
  const hints = hintsFor(pathname, t);
  return (
    <View style={styles.bar} pointerEvents="none">
      {hints.map((h) => (
        <View key={h.label} style={styles.hint}>
          <Ionicons name={h.icon} size={14} color={colors.accent} />
          <Txt variant="tiny" color={colors.textMuted}>
            {h.label}
          </Txt>
        </View>
      ))}
      <View style={{ flex: 1 }} />
      <Txt variant="tiny" color={colors.textMuted}>
        {clock}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
