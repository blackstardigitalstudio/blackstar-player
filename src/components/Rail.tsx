import React from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
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
  if (!items.length) return null;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="h3" style={{ marginLeft: spacing.lg, marginBottom: spacing.sm }}>
        {title}
      </Txt>
      <FlatList
        horizontal
        data={items}
        keyExtractor={(i) => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        initialNumToRender={8}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => (
          <Focusable onSelect={() => onSelect(item)} focusStyle={EMPTY}>
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
  const { width } = useWindowDimensions();
  const cardW = variant === 'poster' ? POSTER_W : TILE_W;
  const cols = Math.max(2, Math.floor((width - spacing.lg) / (cardW + spacing.md)));

  return (
    <FlatList
      data={items}
      key={`${variant}-${cols}`}
      numColumns={cols}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={cols > 1 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xxl }}
      initialNumToRender={cols * 3}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item }) => (
        <Focusable onSelect={() => onSelect(item)} focusStyle={EMPTY}>
          {(f) => <CardFor item={item} focused={f} variant={variant} />}
        </Focusable>
      )}
    />
  );
}
