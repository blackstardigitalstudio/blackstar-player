import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { useT } from '@/i18n';
import { useStore } from '@/store/useStore';
import { sortCategories } from '@/lib/categories';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Category, MediaItem, MediaKind } from '@/lib/types';
import { MediaGrid } from './Rail';
import { Empty, Txt } from './ui';

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} style={[styles.chip, active && styles.chipActive]} focusStyle={styles.chipFocus}>
      {(focused) => (
        <Txt variant="small" color={active || focused ? colors.text : colors.textMuted}>
          {label}
        </Txt>
      )}
    </Focusable>
  );
}

export function Browser({
  title,
  items,
  categories,
  kind,
  onSelect,
  variant,
}: {
  title: string;
  items: MediaItem[];
  categories: Category[];
  kind: MediaKind;
  onSelect: (item: MediaItem) => void;
  variant: 'poster' | 'tile';
}) {
  const t = useT();
  const order = useStore((s) => s.settings.categoryOrder);
  const manual = useStore((s) => s.settings.categoryManual);
  const taste = useStore((s) => s.taste);
  const cats = useMemo(
    () => sortCategories(categories.filter((c) => c.kind === kind), order, taste, manual),
    [categories, kind, order, taste, manual],
  );
  const [sel, setSel] = useState<string>('all');

  const filtered = useMemo(
    () => (sel === 'all' ? items : items.filter((i) => i.categoryId === sel)),
    [items, sel],
  );

  if (!items.length) {
    return <Empty title={t('br.empty', { title })} hint={t('br.emptyHint')} />;
  }

  const header = (
    <View style={{ paddingBottom: spacing.sm }}>
      <Txt variant="h2" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
        {title}
        <Txt variant="small">{`  ·  ${items.length}`}</Txt>
      </Txt>
      {cats.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}
        >
          <Chip label={t('common.all')} active={sel === 'all'} onPress={() => setSel('all')} />
          {cats.map((c) => (
            <Chip key={c.id} label={c.name} active={sel === c.id} onPress={() => setSel(c.id)} />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  return <MediaGrid items={filtered} onSelect={onSelect} variant={variant} header={header} />;
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.surfaceHi },
  chipFocus: { borderColor: colors.borderFocus },
});
