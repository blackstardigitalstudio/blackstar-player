import React, { useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { spacing } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { ChannelCard, PosterCard, POSTER_W, TILE_W } from './Card';
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
  const scrollTo = (index: number) => {
    try {
      ref.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
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
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
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
  const cardW = variant === 'poster' ? POSTER_W : TILE_W;
  const usable = (w || 360) - spacing.lg * 2;
  const cols = Math.max(2, Math.floor((usable + spacing.md) / (cardW + spacing.md)));
  const rowH = cardW + 48; // approx (thumb + label)

  const scrollTo = (index: number) => {
    try {
      ref.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
    } catch {}
  };

  return (
    <FlatList
      ref={ref}
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      data={items}
      key={`${variant}-${cols}`}
      numColumns={cols}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={cols > 1 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl }}
      initialNumToRender={cols * 3}
      maxToRenderPerBatch={cols * 3}
      updateCellsBatchingPeriod={40}
      windowSize={7}
      removeClippedSubviews
      onScrollToIndexFailed={(info) => {
        ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: true });
      }}
      renderItem={({ item, index }) => (
        <Focusable onSelect={() => onSelect(item)} onFocus={() => scrollTo(index)} focusStyle={EMPTY}>
          {(f) => <CardFor item={item} focused={f} variant={variant} />}
        </Focusable>
      )}
    />
  );
}
