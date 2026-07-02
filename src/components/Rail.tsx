import React, { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { spacing } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { CARD_H_POSTER, CARD_H_TILE, ChannelCard, PosterCard, POSTER_W, TILE_W } from './Card';
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
  const ref = useRef<FlatList>(null);
  if (!items.length) return null;
  const itemW = (variant === 'poster' ? POSTER_W : TILE_W) + spacing.md;
  // animated:false keeps measureInWindow accurate for the next D-pad move (no mid-animation races).
  const scrollTo = (index: number) => {
    try {
      ref.current?.scrollToIndex({ index, viewPosition: 0.4, animated: false });
    } catch {}
  };
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="h3" style={{ marginLeft: spacing.lg, marginBottom: spacing.sm }}>
        {title}
      </Txt>
      <FlatList
        ref={ref}
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={false}
        getItemLayout={(_, index) => ({ length: itemW, offset: spacing.lg + itemW * index, index })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => (
          <Focusable onSelect={() => onSelect(item)} onFocus={() => scrollTo(index)} focusStyle={EMPTY}>
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
}: {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  variant?: Variant;
  header?: React.ReactElement;
  empty?: React.ReactElement;
}) {
  const ref = useRef<FlatList>(null);
  const [w, setW] = useState(0);
  const offY = useRef(0);
  const listH = useRef(0);
  const cardW = variant === 'poster' ? POSTER_W : TILE_W;
  const usable = (w || 360) - spacing.lg * 2;
  const cols = Math.max(2, Math.floor((usable + spacing.md) / (cardW + spacing.md)));
  const cardH = variant === 'poster' ? CARD_H_POSTER : CARD_H_TILE;
  const rowH = cardH + spacing.md; // exact: fixed card height + row gap
  const PAD_TOP = spacing.md;

  // Margin-based scroll-follow (same rule as FocusScrollView): only scroll when the
  // focused row would fall outside a comfortable margin. Exact math + animated:false
  // → deterministic, no drift, no measure race during fast D-pad navigation.
  const scrollTo = (index: number) => {
    const vh = listH.current;
    if (!vh) return;
    const row = Math.floor(index / cols);
    const top = PAD_TOP + row * rowH;
    const bottom = top + rowH;
    const m = rowH * 0.5;
    let target = offY.current;
    if (top - offY.current < m) target = top - m;
    else if (bottom - offY.current > vh - m) target = bottom - (vh - m);
    target = Math.max(0, target);
    if (Math.abs(target - offY.current) > 2) {
      offY.current = target;
      ref.current?.scrollToOffset({ offset: target, animated: false });
    }
  };

  return (
    <FlatList
      ref={ref}
      onLayout={(e) => {
        setW(e.nativeEvent.layout.width);
        listH.current = e.nativeEvent.layout.height;
      }}
      onScroll={(e) => {
        offY.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      data={items}
      key={`${variant}-${cols}`}
      numColumns={cols}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={cols > 1 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.md, paddingTop: PAD_TOP, paddingBottom: spacing.xxl }}
      initialNumToRender={cols * 4}
      maxToRenderPerBatch={cols * 4}
      updateCellsBatchingPeriod={40}
      windowSize={11}
      removeClippedSubviews={false}
      getItemLayout={(_, index) => ({ length: rowH, offset: PAD_TOP + rowH * Math.floor(index / cols), index })}
      onScrollToIndexFailed={(info) => {
        ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: false });
      }}
      renderItem={({ item, index }) => (
        <Focusable onSelect={() => onSelect(item)} onFocus={() => scrollTo(index)} focusStyle={EMPTY}>
          {(f) => <CardFor item={item} focused={f} variant={variant} />}
        </Focusable>
      )}
    />
  );
}
