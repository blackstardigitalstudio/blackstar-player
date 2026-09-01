import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusList, useListScroll } from '@/tv/FocusList';
import { spacing } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { CARD_H_POSTER, CARD_H_TILE, ChannelCard, ListRow, PosterCard, POSTER_W, ROW_H, TILE_W } from './Card';
import { Txt } from './ui';

const EMPTY = {}; // disable Focusable default ring; cards render their own focus

type Variant = 'poster' | 'tile';

function CardFor({ item, focused, variant }: { item: MediaItem; focused: boolean; variant: Variant }) {
  return variant === 'poster' ? <PosterCard item={item} focused={focused} /> : <ChannelCard item={item} focused={focused} />;
}

export function Rail({
  title,
  items,
  onSelect,
  variant = 'poster',
}: {
  title: string;
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  variant?: Variant;
}) {
  const s = useListScroll(true); // horizontal
  if (!items.length) return null;
  const itemW = (variant === 'poster' ? POSTER_W : TILE_W) + spacing.md;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="h3" style={{ marginLeft: spacing.lg, marginBottom: spacing.sm }}>
        {title}
      </Txt>
      <FocusList
        ref={s.ref}
        horizontal
        data={items}
        keyExtractor={(i: MediaItem) => i.id}
        showsHorizontalScrollIndicator={false}
        onScroll={s.onScroll}
        onLayout={s.onLayout}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        getItemLayout={(_: any, index: number) => ({ length: itemW, offset: spacing.lg + itemW * index, index })}
        onScrollToIndexFailed={(info: any) => {
          s.ref.current?.scrollToOffset({ offset: spacing.lg + itemW * info.index, animated: false });
        }}
        renderItem={({ item, index }: { item: MediaItem; index: number }) => (
          <Focusable onSelect={() => onSelect(item)} onFocus={() => s.reveal(spacing.lg + itemW * index, itemW)} focusStyle={EMPTY}>
            {(f) => <CardFor item={item} focused={f} variant={variant} />}
          </Focusable>
        )}
      />
    </View>
  );
}

export function MediaGrid({
  items,
  onSelect,
  variant = 'poster',
  header,
  empty,
  autoFocusFirst,
  focusItemId,
  onItemFocus,
  layout = 'grid',
}: {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  variant?: Variant;
  header?: React.ReactElement;
  empty?: React.ReactElement;
  /** When true, the first card gets D-pad focus on mount (e.g. after opening a folder). */
  autoFocusFirst?: boolean;
  /** Come back to the card you left on instead of the first one. Wins over
   *  autoFocusFirst; ignored when the id is no longer in the list. */
  focusItemId?: string | null;
  /** Fires when the D-pad lands on a card (drives the live preview). */
  onItemFocus?: (item: MediaItem) => void;
  /** 'grid' = squares side by side, 'list' = one title per row. User's choice. */
  layout?: 'grid' | 'list';
}) {
  const s = useListScroll(); // vertical, shared margin-based scroll-follow
  const [w, setW] = useState(0);
  const list = layout === 'list';
  const cardW = variant === 'poster' ? POSTER_W : TILE_W;
  const usable = (w || 360) - spacing.lg * 2;
  const cols = list ? 1 : Math.max(2, Math.floor((usable + spacing.md) / (cardW + spacing.md)));
  const cardH = variant === 'poster' ? CARD_H_POSTER : CARD_H_TILE;
  const rowH = list ? ROW_H + spacing.sm : cardH + spacing.md; // exact height + row gap
  const PAD_TOP = spacing.md;

  // Restoring a deep card: scroll to its row FIRST, so the cell actually mounts —
  // only a mounted cell can take hasTVPreferredFocus. Runs once, as soon as the
  // real width is known (before that `cols` is a guess and the row would be wrong).
  const restoreIdx = focusItemId ? items.findIndex((i) => i.id === focusItemId) : -1;
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !w || restoreIdx <= 0) return;
    restored.current = true;
    const row = Math.floor(restoreIdx / cols);
    s.ref.current?.scrollToOffset({ offset: Math.max(0, PAD_TOP + (row - 1) * rowH), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, restoreIdx, cols]);

  return (
    <FocusList
      ref={s.ref}
      onLayout={(e: any) => {
        setW(e.nativeEvent.layout.width);
        s.onLayout(e);
      }}
      onScroll={s.onScroll}
      data={items}
      key={`${variant}-${layout}-${cols}`}
      numColumns={cols}
      keyExtractor={(i: MediaItem) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={cols > 1 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{
        gap: list ? spacing.sm : spacing.md,
        paddingTop: PAD_TOP,
        paddingBottom: spacing.xxl,
        ...(list ? { paddingHorizontal: spacing.lg } : null),
      }}
      // ~2 screens of rows either side of the focused one: plenty for a one-step
      // D-pad move, and roughly a third of the images the default would mount.
      windowSize={7}
      initialNumToRender={cols * 3}
      // Two rows per batch instead of four: each poster row costs remote images
      // to fetch and decode, and a fat batch blocks the JS thread long enough for
      // the focus ring to arrive late behind the D-pad.
      maxToRenderPerBatch={cols * 2}
      updateCellsBatchingPeriod={60}
      getItemLayout={(_: any, index: number) => ({ length: rowH, offset: PAD_TOP + rowH * Math.floor(index / cols), index })}
      onScrollToIndexFailed={(info: any) => {
        s.ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: false });
      }}
      renderItem={({ item, index }: { item: MediaItem; index: number }) => (
        <Focusable
          onSelect={() => onSelect(item)}
          onFocus={() => {
            s.reveal(PAD_TOP + Math.floor(index / cols) * rowH, rowH);
            onItemFocus?.(item);
          }}
          autoFocus={restoreIdx >= 0 ? index === restoreIdx : autoFocusFirst && index === 0}
          focusStyle={EMPTY}
        >
          {(f) => (list ? <ListRow item={item} focused={f} /> : <CardFor item={item} focused={f} variant={variant} />)}
        </Focusable>
      )}
    />
  );
}
