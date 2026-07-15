import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusList, useListScroll } from '@/tv/FocusList';
import { useT } from '@/i18n';
import { useStore } from '@/store/useStore';
import { sortCategories } from '@/lib/categories';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Category, MediaItem, MediaKind } from '@/lib/types';
import { MediaGrid } from './Rail';
import { Empty, Txt } from './ui';

const CAT_ROW = 46;

function Chip({ label, active, onPress, onFocus, autoFocus }: { label: string; active: boolean; onPress: () => void; onFocus?: () => void; autoFocus?: boolean }) {
  return (
    <Focusable onSelect={onPress} onFocus={onFocus} autoFocus={autoFocus} style={[styles.catRow, active && styles.active]} focusStyle={styles.focus}>
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
  const catScroll = useListScroll();

  // If the list refreshes (partial→full renumbers ids, or the source changes) and
  // the selected category disappears, fall back to "all" so the grid never ends
  // up mysteriously empty while channels actually exist.
  useEffect(() => {
    if (sel !== 'all' && !cats.some((c) => c.id === sel)) setSel('all');
  }, [cats, sel]);

  const filtered = useMemo(
    () => (sel === 'all' ? items : items.filter((i) => i.categoryId === sel)),
    [items, sel],
  );

  if (!items.length) {
    return <Empty title={t('br.empty', { title })} hint={t('br.emptyHint')} />;
  }

  const data = [{ id: 'all', name: t('common.all') }, ...cats.map((c) => ({ id: c.id, name: c.name }))];

  // Subcategories in a fixed LEFT column + content grid on the right (10-foot).
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={styles.catCol}>
        <Txt variant="h3" numberOfLines={1} style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
          {title}
        </Txt>
        <FocusList
          ref={catScroll.ref}
          data={data}
          keyExtractor={(c: any) => c.id}
          showsVerticalScrollIndicator={false}
          onScroll={catScroll.onScroll}
          onLayout={catScroll.onLayout}
          getItemLayout={(_: any, index: number) => ({ length: CAT_ROW, offset: CAT_ROW * index, index })}
          onScrollToIndexFailed={() => {}}
          renderItem={({ item, index }: any) => (
            // Auto-focus the first category when the screen opens so the D-pad lands
            // INSIDE the content instead of staying stuck on the side menu.
            <Chip label={item.name} active={sel === item.id} autoFocus={index === 0} onPress={() => setSel(item.id)} onFocus={() => catScroll.reveal(CAT_ROW * index, CAT_ROW)} />
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
  active: { backgroundColor: colors.surfaceHi, borderColor: colors.accent },
  focus: { backgroundColor: colors.surfaceHi, borderColor: colors.borderFocus, borderWidth: 1 },
});
