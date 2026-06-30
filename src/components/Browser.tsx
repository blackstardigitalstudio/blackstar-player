import { useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { useT } from '@/i18n';
import { useStore } from '@/store/useStore';
import { sortCategories } from '@/lib/categories';
import { colors, compact, radius, spacing } from '@/theme/tokens';
import type { Category, MediaItem, MediaKind } from '@/lib/types';
import { MediaGrid } from './Rail';
import { Empty, Txt } from './ui';

const CAT_ROW = 46;

function Chip({ label, active, onPress, onFocus, full }: { label: string; active: boolean; onPress: () => void; onFocus?: () => void; full?: boolean }) {
  return (
    <Focusable onSelect={onPress} onFocus={onFocus} style={[full ? styles.catRow : styles.chip, active && styles.active]} focusStyle={styles.focus}>
      {(f) => (
        <Txt variant="small" numberOfLines={1} color={active || f ? colors.text : colors.textMuted}>
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
  const catRef = useRef<FlatList>(null);

  const filtered = useMemo(
    () => (sel === 'all' ? items : items.filter((i) => i.categoryId === sel)),
    [items, sel],
  );

  if (!items.length) {
    return <Empty title={t('br.empty', { title })} hint={t('br.emptyHint')} />;
  }

  const data = [{ id: 'all', name: t('common.all') }, ...cats.map((c) => ({ id: c.id, name: c.name }))];

  // PHONE: categories as a horizontal bar on top + grid below.
  if (compact) {
    const header = (
      <View style={{ paddingBottom: spacing.sm }}>
        <Txt variant="h2" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          {title} <Txt variant="small">{`· ${items.length}`}</Txt>
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
          {data.map((c) => (
            <Chip key={c.id} label={c.name} active={sel === c.id} onPress={() => setSel(c.id)} />
          ))}
        </ScrollView>
      </View>
    );
    return <MediaGrid items={filtered} onSelect={onSelect} variant={variant} header={header} />;
  }

  // TV: subcategories in a fixed LEFT column + content grid on the right.
  const scrollCat = (index: number) => {
    try {
      catRef.current?.scrollToIndex({ index, viewPosition: 0.5, animated: true });
    } catch {}
  };
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={styles.catCol}>
        <Txt variant="h3" numberOfLines={1} style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {title}
        </Txt>
        <FlatList
          ref={catRef}
          data={data}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          getItemLayout={(_, index) => ({ length: CAT_ROW, offset: CAT_ROW * index, index })}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }) => (
            <Chip full label={item.name} active={sel === item.id} onPress={() => setSel(item.id)} onFocus={() => scrollCat(index)} />
          )}
        />
      </View>
      <View style={{ flex: 1 }}>
        <MediaGrid items={filtered} onSelect={onSelect} variant={variant} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  catCol: { width: 230, paddingVertical: spacing.md, borderRightWidth: 1, borderRightColor: colors.border },
  catRow: {
    height: CAT_ROW,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    marginHorizontal: 6,
    borderRadius: radius.md,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.surfaceHi, borderColor: colors.accent },
  focus: { backgroundColor: colors.surfaceHi, borderColor: colors.borderFocus, borderWidth: 1 },
});
