import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, font, gradients, radius } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { useStore } from '@/store/useStore';
import { Txt } from './ui';

// Square thumbnails: uniform, images shown with "contain" (never cropped/zoomed).
// Same square for posters and channels. 10-foot sizing (box / Android TV).
export const POSTER_W = 168;
export const POSTER_H = POSTER_W;
export const TILE_W = POSTER_W;
export const TILE_H = POSTER_W;

// The thumbnail is drawn at 86% of the square, in REAL PIXELS. Percentages made
// expo-image wait for layout before it knew the target size, so a 1000x1500
// Xtream poster could be decoded at full size for a 144px box — a hundred of
// those on screen starved the JS thread and the focus ring lagged behind the
// remote. An explicit size lets it downsample straight away.
const IMG_PX = Math.round(POSTER_W * 0.86);

// FIXED card heights so grid rows are deterministic (exact scroll math, no drift).
// Rule: explicit line height + fixed label box. Poster label = 2 lines, tile = 1.
const LABEL_LINE = Math.round(font.small * 1.28);
const LABEL_MT = 6;
export const CARD_H_POSTER = POSTER_H + LABEL_MT + LABEL_LINE * 2;
export const CARD_H_TILE = TILE_H + LABEL_MT + LABEL_LINE;

function Fallback({ name, icon }: { name: string; icon?: any }) {
  return (
    <LinearGradient colors={gradients.brandSoft} style={[StyleSheet.absoluteFill, styles.center]}>
      {icon ? (
        <Ionicons name={icon} size={36} color={colors.white} />
      ) : (
        <Txt variant="h1" color={colors.white}>
          {(name || '?').trim().charAt(0).toUpperCase()}
        </Txt>
      )}
    </LinearGradient>
  );
}

function Square({ item, focused, fallbackIcon }: { item: MediaItem; focused: boolean; fallbackIcon?: any }) {
  return (
    <View style={[styles.thumb, focused && styles.thumbFocus]}>
      {item.logo ? (
        <Image
          source={{ uri: item.logo }}
          style={styles.img}
          contentFit="contain"
          // No cross-fade: in a grid it means one running animation per visible
          // card, for a fade nobody looks at while moving the D-pad.
          transition={0}
          recyclingKey={item.id}
          cachePolicy="memory-disk"
          priority="low"
        />
      ) : (
        <Fallback name={item.name} icon={fallbackIcon} />
      )}
    </View>
  );
}

export function PosterCard({ item, focused }: { item: MediaItem; focused: boolean }) {
  return (
    <View style={{ width: POSTER_W }}>
      <Square item={item} focused={focused} fallbackIcon={item.kind === 'series' ? 'albums' : 'film'} />
      {item.rating ? (
        <View style={styles.badge}>
          <Ionicons name="star" size={11} color={colors.warning} />
          <Txt variant="tiny" color={colors.text}>
            {item.rating}
          </Txt>
        </View>
      ) : null}
      <View style={{ height: LABEL_LINE * 2, marginTop: LABEL_MT }}>
        <Txt variant="small" numberOfLines={2} style={{ lineHeight: LABEL_LINE, color: focused ? colors.text : colors.textMuted }}>
          {item.name}
        </Txt>
      </View>
    </View>
  );
}

// --- LIST layout ------------------------------------------------------------
// One title per row, read left to right like a channel list on a set-top box.
// Fixed height, same rule as the cards: the grid maths must stay exact.
export const ROW_H = 72;
const ROW_IMG = 52;

export function ListRow({ item, focused }: { item: MediaItem; focused: boolean }) {
  const showNumbers = useStore((s) => s.settings.showChannelNumbers);
  const number = showNumbers && typeof item.number === 'number' ? item.number : null;
  const sub = [item.year, item.rating ? `★ ${item.rating}` : null, item.categoryName].filter(Boolean).join('  ·  ');
  return (
    <View style={[styles.row, focused && styles.rowFocus]}>
      {number !== null ? (
        <Txt variant="small" color={focused ? colors.accent : colors.textFaint} style={styles.rowNum}>
          {number}
        </Txt>
      ) : null}
      <View style={styles.rowThumb}>
        {item.logo ? (
          <Image
            source={{ uri: item.logo }}
            style={{ width: ROW_IMG - 8, height: ROW_IMG - 8 }}
            contentFit="contain"
            transition={0}
            recyclingKey={item.id}
            cachePolicy="memory-disk"
            priority="low"
          />
        ) : (
          <Fallback name={item.name} icon={item.kind === 'live' ? 'tv' : item.kind === 'series' ? 'albums' : 'film'} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="body" numberOfLines={1} style={{ color: focused ? colors.text : colors.textMuted, fontWeight: '600' }}>
          {item.name}
        </Txt>
        {sub ? (
          <Txt variant="tiny" color={colors.textFaint} numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

export function ChannelCard({ item, focused }: { item: MediaItem; focused: boolean }) {
  const showNumbers = useStore((s) => s.settings.showChannelNumbers);
  return (
    <View style={{ width: TILE_W }}>
      <Square item={item} focused={focused} fallbackIcon="tv" />
      {showNumbers && typeof item.number === 'number' ? (
        <View style={styles.num}>
          <Txt variant="tiny" color={colors.text}>
            {item.number}
          </Txt>
        </View>
      ) : null}
      <View style={{ height: LABEL_LINE, marginTop: LABEL_MT }}>
        <Txt variant="small" numberOfLines={1} style={{ lineHeight: LABEL_LINE, color: focused ? colors.text : colors.textMuted }}>
          {item.name}
        </Txt>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  thumb: {
    width: POSTER_W,
    height: POSTER_W,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Color-only focus ring — box-app-rules R2. The old ring added elevation +
  // a shadow, which on Android promotes the card to its own render layer and
  // recomputes a shadow on every focus change: exactly the per-keypress cost you
  // feel as "the selection arrives late" on a grid of heavy posters.
  thumbFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  img: { width: IMG_PX, height: IMG_PX },
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: colors.bgElevated,
  },
  rowFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  rowNum: { width: 46, textAlign: 'right', fontVariant: ['tabular-nums'] },
  rowThumb: {
    width: ROW_IMG,
    height: ROW_IMG,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  num: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(10,10,15,0.85)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
