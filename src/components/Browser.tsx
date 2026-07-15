import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TVFocusGuideView, View } from 'react-native';
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

function Chip({
  label,
  active,
  pinned,
  onPress,
  onLongSelect,
  onFocus,
  autoFocus,
}: {
  label: string;
  active: boolean;
  pinned?: boolean;
  onPress: () => void;
  onLongSelect?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}) {
  return (
    <Focusable onSelect={onPress} onLongSelect={onLongSelect} onFocus={onFocus} autoFocus={autoFocus} style={[styles.catRow, active && styles.active]} focusStyle={styles.focus}>
      {(f) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {pinned ? <Ionicons name="star" size={13} color={colors.accent} /> : null}
          <Txt variant="small" numberOfLines={1} color={active || f ? colors.text : colors.textMuted} style={{ flex: 1 }}>
            {label}
          </Txt>
        </View>
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
  const pins = useStore((s) => s.settings.categoryPins);
  const togglePin = useStore((s) => s.toggleCategoryPin);
  const taste = useStore((s) => s.taste);
  const cats = useMemo(
    () => sortCategories(categories.filter((c) => c.kind === kind), order, taste, manual, pins),
    [categories, kind, order, taste, manual, pins],
  );
  // Favourites of THIS section (live channels, films, series) get their own entry
  // at the TOP of the category column. Intersect with the current list so we never
  // show a stale favourite that no longer exists in the source.
  const favorites = useStore((s) => s.favorites);
  const favItems = useMemo(() => {
    const favIds = new Set(favorites.map((f) => f.id));
    return items.filter((i) => favIds.has(i.id));
  }, [favorites, items]);
  // Recently watched of THIS section (watch order), still present in the list →
  // "Visti di recente" entry for quick re-access / recommendations.
  const recents = useStore((s) => s.recents);
  const recentItems = useMemo(() => {
    const byId = new Map(items.map((i) => [i.id, i]));
    const out: MediaItem[] = [];
    for (const r of recents) {
      const it = byId.get(r.id);
      if (it) out.push(it);
    }
    return out;
  }, [recents, items]);
  const [sel, setSel] = useState<string>('all');
  const catScroll = useListScroll();

  // If the list refreshes (partial→full renumbers ids, or the source changes) and
  // the selected category disappears, fall back to "all" so the grid never ends
  // up mysteriously empty while channels actually exist.
  useEffect(() => {
    if (sel === 'fav') {
      if (!favItems.length) setSel('all');
    } else if (sel === 'recent') {
      if (!recentItems.length) setSel('all');
    } else if (sel !== 'all' && !cats.some((c) => c.id === sel)) {
      setSel('all');
    }
  }, [cats, sel, favItems.length, recentItems.length]);

  const filtered = useMemo(
    () =>
      sel === 'all'
        ? items
        : sel === 'fav'
          ? favItems
          : sel === 'recent'
            ? recentItems
            : items.filter((i) => i.categoryId === sel),
    [items, sel, favItems, recentItems],
  );

  if (!items.length) {
    return <Empty title={t('br.empty', { title })} hint={t('br.emptyHint')} />;
  }

  const data = [
    ...(favItems.length ? [{ id: 'fav', name: t('br.favorites') }] : []),
    ...(recentItems.length ? [{ id: 'recent', name: t('br.recent') }] : []),
    { id: 'all', name: t('common.all') },
    ...cats.map((c) => ({ id: c.id, name: c.name })),
  ];

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
          renderItem={({ item, index }: any) => {
            // Real categories can be PINNED by holding OK (star + float to top).
            const special = item.id === 'all' || item.id === 'fav' || item.id === 'recent';
            return (
              // Auto-focus the first category when the screen opens so the D-pad lands
              // INSIDE the content instead of staying stuck on the side menu.
              <Chip
                label={item.name}
                active={sel === item.id}
                pinned={!special && pins.includes(item.id)}
                autoFocus={index === 0}
                onPress={() => setSel(item.id)}
                onLongSelect={special ? undefined : () => togglePin(item.id)}
                onFocus={() => catScroll.reveal(CAT_ROW * index, CAT_ROW)}
              />
            );
          }}
        />
      </View>
      {/* autoFocus: RIGHT from the category column lands on a real card in the grid
          (and returns to the last card). */}
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <MediaGrid items={filtered} onSelect={onSelect} variant={variant} />
      </TVFocusGuideView>
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
