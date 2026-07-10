import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { GhostButton, Screen, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { FocusScrollView } from '@/tv/FocusScroll';
import { useStore } from '@/store/useStore';
import { useT } from '@/i18n';
import type { CatOrder } from '@/lib/categories';
import { colors, radius, spacing } from '@/theme/tokens';

const MODES: { key: CatOrder; i18n: string }[] = [
  { key: 'default', i18n: 'cat.default' },
  { key: 'alpha', i18n: 'cat.alpha' },
  { key: 'mostWatched', i18n: 'cat.mostWatched' },
  { key: 'manual', i18n: 'cat.manual' },
];

const KIND_NAV: Record<string, string> = { live: 'nav.live', movie: 'nav.movies', series: 'nav.series' };

export default function Categories() {
  const router = useRouter();
  const t = useT();
  const categories = useStore((s) => s.content.categories);
  const order = useStore((s) => s.settings.categoryOrder);
  const manual = useStore((s) => s.settings.categoryManual);
  const update = useStore((s) => s.updateSettings);

  // Full manual order: stored ids first, then any not-yet-ordered categories.
  const fullManual = useMemo(() => {
    const ids = categories.map((c) => c.id);
    const ordered = manual.filter((id) => ids.includes(id));
    const missing = ids.filter((id) => !ordered.includes(id));
    return [...ordered, ...missing];
  }, [categories, manual]);

  const orderedCats = useMemo(
    () => fullManual.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as typeof categories,
    [fullManual, categories],
  );

  const setMode = (m: CatOrder) => {
    if (m === 'manual' && manual.length === 0) update({ categoryOrder: m, categoryManual: fullManual });
    else update({ categoryOrder: m });
  };

  const move = (index: number, dir: number) => {
    const j = index + dir;
    if (j < 0 || j >= fullManual.length) return;
    const arr = [...fullManual];
    [arr[index], arr[j]] = [arr[j], arr[index]];
    update({ categoryManual: arr });
  };

  return (
    <Screen>
      <FocusScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md }}>
          <GhostButton label={t('common.back')} icon="arrow-back" onPress={() => router.back()} />
          <Txt variant="h2">{t('cat.title')}</Txt>
        </View>

        <View style={styles.chips}>
          {MODES.map((m) => (
            <Focusable key={m.key} onSelect={() => setMode(m.key)} style={[styles.chip, order === m.key && styles.chipActive]} focusStyle={styles.chipFocus}>
              {(f) => (
                <Txt variant="small" color={order === m.key || f ? colors.text : colors.textMuted}>
                  {t(m.i18n)}
                </Txt>
              )}
            </Focusable>
          ))}
        </View>

        {order === 'manual' ? (
          <>
            <Txt variant="tiny" style={{ marginBottom: spacing.md }}>
              {t('cat.manualHint')}
            </Txt>
            <View style={{ gap: spacing.sm }}>
              {orderedCats.map((c, i) => (
                <View key={c.id} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Txt variant="body" numberOfLines={1}>
                      {c.name}
                    </Txt>
                    <Txt variant="tiny">{t(KIND_NAV[c.kind] || 'nav.live')}</Txt>
                  </View>
                  <Focusable onSelect={() => move(i, -1)} style={styles.arrow} focusStyle={styles.arrowFocus}>
                    <Ionicons name="chevron-up" size={20} color={colors.text} />
                  </Focusable>
                  <Focusable onSelect={() => move(i, 1)} style={styles.arrow} focusStyle={styles.arrowFocus}>
                    <Ionicons name="chevron-down" size={20} color={colors.text} />
                  </Focusable>
                </View>
              ))}
            </View>
          </>
        ) : null}
      </FocusScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: { paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  chipFocus: { borderColor: colors.borderFocus },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgElevated, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  arrow: { width: 46, height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  arrowFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
});
