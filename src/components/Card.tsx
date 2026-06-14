import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, font, gradients, radius, spacing } from '@/theme/tokens';
import type { MediaItem } from '@/lib/types';
import { Txt } from './ui';

export const POSTER_W = 158;
export const POSTER_H = 232;
export const TILE_W = 196;
export const TILE_H = 130;

function Fallback({ name, rounded = radius.md }: { name: string; rounded?: number }) {
  return (
    <LinearGradient colors={gradients.brandSoft} style={[StyleSheet.absoluteFill, { borderRadius: rounded, alignItems: 'center', justifyContent: 'center' }]}>
      <Txt variant="h1" color={colors.white}>
        {(name || '?').trim().charAt(0).toUpperCase()}
      </Txt>
    </LinearGradient>
  );
}

export function PosterCard({ item, focused }: { item: MediaItem; focused: boolean }) {
  return (
    <View style={{ width: POSTER_W }}>
      <View style={[styles.poster, focused && styles.posterFocus]}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <Fallback name={item.name} />
        )}
        {item.rating ? (
          <View style={styles.badge}>
            <Ionicons name="star" size={11} color={colors.warning} />
            <Txt variant="tiny" color={colors.text}>
              {item.rating}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt variant="small" numberOfLines={1} style={{ marginTop: 6, color: focused ? colors.text : colors.textMuted }}>
        {item.name}
      </Txt>
    </View>
  );
}

export function ChannelCard({ item, focused }: { item: MediaItem; focused: boolean }) {
  return (
    <View style={{ width: TILE_W }}>
      <View style={[styles.tile, focused && styles.posterFocus]}>
        {item.logo ? (
          <Image source={{ uri: item.logo }} style={styles.logo} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name="tv" size={40} color={colors.textFaint} />
        )}
        {typeof item.number === 'number' ? (
          <View style={styles.num}>
            <Txt variant="tiny" color={colors.text}>
              {item.number}
            </Txt>
          </View>
        ) : null}
      </View>
      <Txt variant="small" numberOfLines={1} style={{ marginTop: 6, color: focused ? colors.text : colors.textMuted }}>
        {item.name}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    width: POSTER_W,
    height: POSTER_H,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tile: {
    width: TILE_W,
    height: TILE_H,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  logo: { width: '78%', height: '70%' },
  posterFocus: {
    borderColor: colors.borderFocus,
    shadowColor: colors.accent,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    elevation: 14,
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
    backgroundColor: 'rgba(10,10,15,0.8)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
