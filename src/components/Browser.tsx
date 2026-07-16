import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, StyleSheet, TVFocusGuideView, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusList, useListScroll } from '@/tv/FocusList';
import { useT } from '@/i18n';
import { useStore } from '@/store/useStore';
import { sortCategories } from '@/lib/categories';
import { colors, radius, spacing } from '@/theme/tokens';
import type { Category, MediaItem, MediaKind } from '@/lib/types';
import { MediaGrid } from './Rail';
import { Empty, Txt } from './ui';

// Box (D-pad) version of the phone's folder-tile browser: categories are big
// FOCUSABLE tiles (Preferiti / Visti di recente / Tutti + one per category);
// selecting one opens its channels in a grid with a "back to categories" bar.
// Same interface as blackstar-mobile — adapted only for the remote: native
// Focusable rings, FocusList scroll-follow (R3), first-item auto-focus, and the
// hardware BACK button closes an open folder instead of leaving the tab.

const TILE_H = 128;

/** A friendly icon guessed from the category name (recognise, don't read). */
function iconForCategory(name: string): any {
  const n = name.toLowerCase();
  if (/(sport|calcio|football|f[uú]tbol|deporte|tennis|basket|motogp|f1)/.test(n)) return 'football';
  if (/(news|notizi|notici|tg\b|24h|24\/7|meteo)/.test(n)) return 'newspaper';
  if (/(kid|bimb|bambin|cartoon|infantil|ni[nñ]o|junior|disney)/.test(n)) return 'happy';
  if (/(cinema|film|movie|pel[ií]cul|cine)/.test(n)) return 'film';
  if (/(music|m[uú]sic|radio|hits)/.test(n)) return 'musical-notes';
  if (/(serie|show|entertain|intratten)/.test(n)) return 'albums';
  if (/(doc|natur|planet|discovery|history|storia)/.test(n)) return 'planet';
  if (/(cucin|food|cook|gastro|chef|recip)/.test(n)) return 'restaurant';
  if (/(viagg|travel|viaje|turism)/.test(n)) return 'airplane';
  if (/(relig|church|chiesa|iglesia|cristian|islam|gospel)/.test(n)) return 'book';
  if (/(lifestyle|fashion|moda|shopping|casa|home)/.test(n)) return 'shirt';
  if (/(adult|xxx|18\+|\+18|porn)/.test(n)) return 'lock-closed';
  return 'tv';
}

/** Big focusable category folder tile: icon + name + count. */
function FolderTile({
  name,
  count,
  countKey,
  icon,
  width,
  pinned,
  autoFocus,
  onPress,
  onLongSelect,
  onFocus,
}: {
  name: string;
  count: number;
  countKey: string;
  icon: any;
  width: number;
  pinned?: boolean;
  autoFocus?: boolean;
  onPress: () => void;
  onLongSelect?: () => void;
  onFocus?: () => void;
}) {
  const t = useT();
  return (
    <Focusable
      onSelect={onPress}
      onLongSelect={onLongSelect}
      onFocus={onFocus}
      autoFocus={autoFocus}
      style={[styles.folder, { width }, pinned && styles.folderPinned]}
      focusStyle={styles.folderFocus}
    >
      {() => (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          {pinned ? (
            <View style={styles.pinBadge}>
              <Ionicons name="star" size={14} color={colors.accent} />
            </View>
          ) : null}
          <View style={styles.folderIcon}>
            <Ionicons name={icon} size={26} color={colors.accent} />
          </View>
          <Txt variant="body" numberOfLines={2} style={{ fontWeight: '700', marginTop: spacing.sm }}>
            {name}
          </Txt>
          <Txt variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
            {t(countKey, { n: count })}
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
  // Accepted for API parity with blackstar-mobile. The box always browses by
  // folders (with a direct grid fallback when a source has no categories).
  folders: _folders,
}: {
  title: string;
  items: MediaItem[];
  categories: Category[];
  kind: MediaKind;
  onSelect: (item: MediaItem) => void;
  variant: 'poster' | 'tile';
  folders?: boolean;
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

  // How many items each category holds (also decides if a folder is worth showing).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) if (i.categoryId) m.set(i.categoryId, (m.get(i.categoryId) ?? 0) + 1);
    return m;
  }, [items]);

  // Favourites of THIS section → their own "Preferiti" folder, shown first.
  // Intersect with `items` so a stale favourite (gone from the source) never shows.
  const favorites = useStore((s) => s.favorites);
  const favItems = useMemo(() => {
    const favIds = new Set(favorites.map((f) => f.id));
    return items.filter((i) => favIds.has(i.id));
  }, [favorites, items]);

  // Recently-watched of THIS section (watch order, still present) → "Visti di recente".
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

  // Which folder is open. null = show the folder grid.
  const [openCat, setOpenCat] = useState<string | null>(null);

  // Hardware BACK closes an open folder (back to the folder grid) instead of
  // leaving the tab. Registered ONLY while a folder is open, and — because
  // Browser mounts under the tabs layout — this listener runs BEFORE the
  // layout's "go Home" handler, so it wins. Closed folder → no listener → the
  // layout handles BACK as before.
  useEffect(() => {
    if (!openCat) return;
    const onBack = () => {
      setOpenCat(null);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [openCat]);

  // If the list refreshes and the open folder id disappears, fall back so the
  // grid never ends up mysteriously empty.
  useEffect(() => {
    if (openCat === 'fav' && !favItems.length) setOpenCat(null);
    else if (openCat === 'recent' && !recentItems.length) setOpenCat(null);
    else if (
      openCat &&
      openCat !== 'all' &&
      openCat !== 'fav' &&
      openCat !== 'recent' &&
      !cats.some((c) => c.id === openCat)
    )
      setOpenCat(null);
  }, [cats, openCat, favItems.length, recentItems.length]);

  if (!items.length) {
    return <Empty title={t('br.empty', { title })} hint={t('br.emptyHint')} />;
  }

  // Kind-aware labels so folders read right in Film/Serie too (not "canali").
  const allLabel = kind === 'movie' ? t('br.allMovies') : kind === 'series' ? t('br.allSeries') : t('br.allChannels');
  const countKey = kind === 'movie' ? 'br.moviesCount' : kind === 'series' ? 'br.seriesCount' : 'br.channelsCount';

  const filteredBy = (id: string) =>
    id === 'all'
      ? items
      : id === 'fav'
        ? favItems
        : id === 'recent'
          ? recentItems
          : items.filter((i) => i.categoryId === id);

  // No categories at all (e.g. a flat M3U) → nothing to fold; show everything.
  const hasFolders = cats.length || favItems.length || recentItems.length;
  if (!hasFolders) {
    return (
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <MediaGrid items={items} onSelect={onSelect} variant={variant} autoFocusFirst />
      </TVFocusGuideView>
    );
  }

  // Level 2: items inside the chosen folder, with a clear "back to categories" bar.
  if (openCat) {
    const folderName =
      openCat === 'all'
        ? allLabel
        : openCat === 'fav'
          ? t('br.favorites')
          : openCat === 'recent'
            ? t('br.recent')
            : cats.find((c) => c.id === openCat)?.name ?? title;
    const channels = filteredBy(openCat);
    const header = (
      <View>
        <Focusable onSelect={() => setOpenCat(null)} style={styles.backRow} focusStyle={styles.backRowFocus}>
          {(f) => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="chevron-back" size={22} color={colors.accent} />
              <Txt variant="small" color={f ? colors.text : colors.accent} style={{ fontWeight: '700' }}>
                {t('br.backToFolders')}
              </Txt>
            </View>
          )}
        </Focusable>
        <Txt variant="h2" style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.sm }}>
          {folderName} <Txt variant="small" color={colors.textFaint}>{`· ${t(countKey, { n: channels.length })}`}</Txt>
        </Txt>
      </View>
    );
    return (
      <TVFocusGuideView autoFocus style={{ flex: 1 }}>
        <MediaGrid items={channels} onSelect={onSelect} variant={variant} header={header} autoFocusFirst />
      </TVFocusGuideView>
    );
  }

  // Level 1: the folder grid.
  return (
    <FolderGrid
      title={title}
      total={items.length}
      cats={cats}
      counts={counts}
      favCount={favItems.length}
      recentCount={recentItems.length}
      pins={pins}
      onTogglePin={togglePin}
      allLabel={allLabel}
      countKey={countKey}
      onOpen={setOpenCat}
    />
  );
}

/** The folder grid — a D-pad-navigable grid of big, focusable category tiles. */
function FolderGrid({
  title,
  total,
  cats,
  counts,
  favCount,
  recentCount,
  pins,
  onTogglePin,
  allLabel,
  countKey,
  onOpen,
}: {
  title: string;
  total: number;
  cats: Category[];
  counts: Map<string, number>;
  favCount: number;
  recentCount: number;
  pins: string[];
  onTogglePin: (id: string) => void;
  allLabel: string;
  countKey: string;
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const s = useListScroll();
  const [w, setW] = useState(0);

  const pad = spacing.lg;
  const gap = spacing.md;
  const usable = (w || 960) - pad * 2;
  const cols = Math.max(2, Math.floor((usable + gap) / (210 + gap)));
  const tileW = Math.floor((usable - gap * (cols - 1)) / cols);
  const rowH = TILE_H + gap;
  const PAD_TOP = spacing.sm;

  // "Preferiti" and "Visti di recente" first (if any), then "Tutti", then a
  // folder per category.
  const tiles = [
    ...(favCount > 0 ? [{ id: 'fav', name: t('br.favorites'), count: favCount, icon: 'heart' as any }] : []),
    ...(recentCount > 0 ? [{ id: 'recent', name: t('br.recent'), count: recentCount, icon: 'time' as any }] : []),
    { id: 'all', name: allLabel, count: total, icon: 'apps' as any },
    ...cats.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0, icon: iconForCategory(c.name) })),
  ];

  const header = (
    <View style={styles.folderHeader}>
      <Txt variant="h2">
        {title} <Txt variant="small" color={colors.textFaint}>{`· ${t(countKey, { n: total })}`}</Txt>
      </Txt>
      <Txt variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
        {t('br.pickFolder')}
      </Txt>
    </View>
  );

  return (
    <FocusList
      ref={s.ref}
      onLayout={(e: any) => {
        setW(e.nativeEvent.layout.width);
        s.onLayout(e);
      }}
      onScroll={s.onScroll}
      data={tiles}
      key={`fg-${cols}`}
      numColumns={cols}
      keyExtractor={(item: any) => item.id}
      ListHeaderComponent={header}
      columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: pad } : undefined}
      contentContainerStyle={{ gap, paddingTop: PAD_TOP, paddingBottom: spacing.xxl }}
      getItemLayout={(_: any, index: number) => ({ length: rowH, offset: PAD_TOP + rowH * Math.floor(index / cols), index })}
      onScrollToIndexFailed={(info: any) => {
        s.ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: false });
      }}
      renderItem={({ item, index }: any) => {
        const special = item.id === 'all' || item.id === 'fav' || item.id === 'recent';
        return (
          <FolderTile
            name={item.name}
            count={item.count}
            countKey={countKey}
            icon={item.icon}
            width={tileW}
            pinned={!special && pins.includes(item.id)}
            autoFocus={index === 0}
            onPress={() => onOpen(item.id)}
            onLongSelect={special ? undefined : () => onTogglePin(item.id)}
            onFocus={() => s.reveal(PAD_TOP + Math.floor(index / cols) * rowH, rowH)}
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  folderHeader: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  folder: {
    height: TILE_H,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'center',
  },
  // Color-only focus ring (same border width) — never changes layout, so no
  // Fabric re-layout / focus loop. See box-app-rules.
  folderFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  folderPinned: { borderColor: colors.accent },
  pinBadge: { position: 'absolute', top: 0, right: 0 },
  folderIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xs,
    marginHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  backRowFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
});
