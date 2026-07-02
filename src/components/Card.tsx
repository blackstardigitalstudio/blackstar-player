import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, font, gradients, radius } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { Txt } from './ui';

// Square thumbnails: uniform, images shown with "contain" (never cropped/zoomed).
// Same square for posters and channels. 10-foot sizing (box / Android TV).
export const POSTER_W = 168;
export const POSTER_H = POSTER_W;
export const TILE_W = POSTER_W;
export const TILE_H = POSTER_W;

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
          transition={120}
          recyclingKey={item.id}
          cachePolicy="memory-disk"
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

export function ChannelCard({ item, focused }: { item: MediaItem; focused: boolean }) {
  return (
    <View style={{ width: TILE_W }}>
      <Square item={item} focused={focused} fallbackIcon="tv" />
      {typeof item.number === 'number' ? (
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
  thumbFocus: {
    borderColor: colors.borderFocus,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 14,
  },
  img: { width: '86%', height: '86%' },
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
