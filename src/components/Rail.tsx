import React, { useState } from 'react';
import { View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusList, useListScroll } from '@/tv/FocusList';
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
}: {
  items: MediaItem[];
  onSelect: (item: MediaItem) => void;
  variant?: Variant;
  header?: React.ReactElement;
  empty?: React.ReactElement;
}) {
  const s = useListScroll(); // vertical, shared margin-based scroll-follow
  const [w, setW] = useState(0);
  const cardW = variant === 'poster' ? POSTER_W : TILE_W;
  const usable = (w || 360) - spacing.lg * 2;
  const cols = Math.max(2, Math.floor((usable + spacing.md) / (cardW + spacing.md)));
  const cardH = variant === 'poster' ? CARD_H_POSTER : CARD_H_TILE;
  const rowH = cardH + spacing.md; // exact: fixed card height + row gap
  const PAD_TOP = spacing.md;

  return (
    <FocusList
      ref={s.ref}
      onLayout={(e: any) => {
        setW(e.nativeEvent.layout.width);
        s.onLayout(e);
      }}
      onScroll={s.onScroll}
      data={items}
      key={`${variant}-${cols}`}
      numColumns={cols}
      keyExtractor={(i: MediaItem) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={cols > 1 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.md, paddingTop: PAD_TOP, paddingBottom: spacing.xxl }}
      initialNumToRender={cols * 4}
      maxToRenderPerBatch={cols * 4}
      getItemLayout={(_: any, index: number) => ({ length: rowH, offset: PAD_TOP + rowH * Math.floor(index / cols), index })}
      onScrollToIndexFailed={(info: any) => {
        s.ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: false });
      }}
      renderItem={({ item, index }: { item: MediaItem; index: number }) => (
        <Focusable onSelect={() => onSelect(item)} onFocus={() => s.reveal(PAD_TOP + Math.floor(index / cols) * rowH, rowH)} focusStyle={EMPTY}>
          {(f) => <CardFor item={item} focused={f} variant={variant} />}
        </Focusable>
      )}
    />
  );
}
