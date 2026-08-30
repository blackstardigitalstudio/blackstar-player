import { StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { useStore } from '@/store/useStore';
import type { Lang } from '@/i18n';
import { colors, radius, spacing } from '@/theme/tokens';
import { Txt } from './ui';

// Two flag chips — you SEE which language is on and select the other to switch.
// A language is always shown in its OWN name so a speaker recognises it at a glance
// (recognise, don't read). One clear choice, no menu. Uses the TV Focusable so the
// D-pad ring is visible on the box; identical to the phone build.
const LANGS = [
  { code: 'it' as const, flag: '🇮🇹', name: 'Italiano' },
  { code: 'es' as const, flag: '🇪🇸', name: 'Español' },
];

/**
 * `big` renders the first-run version (tall tiles, readable from the sofa);
 * `onPicked` lets the caller move on to the next step after the choice.
 * Choosing here also marks the language as CHOSEN, so the first-run step never
 * asks again.
 */
export function LanguagePicker({ big, onPicked }: { big?: boolean; onPicked?: (code: Lang) => void } = {}) {
  const lang = useStore((s) => s.settings.language);
  const update = useStore((s) => s.updateSettings);
  return (
    <View style={styles.row}>
      {LANGS.map((l) => {
        const active = lang === l.code;
        return (
          <Focusable
            key={l.code}
            autoFocus={big && active}
            onSelect={() => {
              update({ language: l.code, languageChosen: true });
              onPicked?.(l.code);
            }}
            style={[styles.chip, big && styles.chipBig, active && styles.active]}
            focusStyle={styles.focus}
          >
            {(f) => (
              <View style={[styles.inner, big && styles.innerBig]}>
                <Txt style={{ fontSize: big ? 48 : 22 }}>{l.flag}</Txt>
                <Txt
                  variant={big ? 'h3' : 'small'}
                  color={active ? colors.onAccent : f ? colors.text : colors.textMuted}
                  style={{ fontWeight: '700' }}
                >
                  {l.name}
                </Txt>
              </View>
            )}
          </Focusable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipBig: { paddingVertical: spacing.xl, borderRadius: radius.lg, borderWidth: 2 },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  innerBig: { flexDirection: 'column', gap: spacing.sm },
  active: { backgroundColor: colors.accent, borderColor: colors.accent },
  focus: { borderColor: colors.borderFocus },
});
