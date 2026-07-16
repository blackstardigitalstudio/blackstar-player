import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { FocusList, useListScroll } from '@/tv/FocusList';
import { useT } from '@/i18n';
import { colors, gradients, radius, spacing } from '@/theme/tokens';
import type { ProgressEntry } from '@/lib/types';
import { POSTER_W, POSTER_H } from './Card';
import { Txt } from './ui';

function Card({ entry, focused }: { entry: ProgressEntry; focused: boolean }) {
  const t = useT();
  const pct = entry.duration > 0 ? Math.min(1, entry.position / entry.duration) : 0;
  const left = Math.max(0, entry.duration - entry.position);
  const mins = Math.round(left / 60);
  const leftLabel = entry.duration ? (mins > 0 ? t('cont.minsLeft', { n: mins }) : t('cont.almostDone')) : '';
  return (
    <View style={{ width: POSTER_W }}>
      <View style={[styles.poster, focused && styles.focus]}>
        {entry.poster ? (
          <Image source={{ uri: entry.poster }} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} recyclingKey={entry.key} cachePolicy="memory-disk" />
        ) : (
          <LinearGradient colors={gradients.brandSoft} style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Txt variant="h1" color={colors.white}>
              {entry.title.trim().charAt(0).toUpperCase()}
            </Txt>
          </LinearGradient>
        )}
        <View style={styles.playBadge}>
          <Ionicons name="play" size={16} color={colors.white} />
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct * 100}%` }]} />
        </View>
      </View>
      <Txt variant="small" numberOfLines={1} style={{ marginTop: 6, color: focused ? colors.text : colors.textMuted }}>
        {entry.title}
      </Txt>
      <Txt variant="tiny">{leftLabel}</Txt>
    </View>
  );
}

export function ContinueRail({ entries, onSelect }: { entries: ProgressEntry[]; onSelect: (e: ProgressEntry) => void }) {
  const t = useT();
  if (!entries.length) return null;
  const itemW = POSTER_W + spacing.md;
  const ref = useRef<FlatList>(null);
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="h3" style={{ marginLeft: spacing.lg, marginBottom: spacing.sm }}>
        {t('home.continue')}
      </Txt>
      <FlatList
        ref={ref}
        horizontal
        data={entries}
        keyExtractor={(e) => e.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        getItemLayout={(_, index) => ({ length: itemW, offset: spacing.lg + itemW * index, index })}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item, index }) => (
          <Focusable
            onSelect={() => onSelect(item)}
            onFocus={() => {
              try {
                ref.current?.scrollToIndex({ index, viewPosition: 0.4, animated: true });
              } catch {}
            }}
            focusStyle={{}}
          >
            {(f) => <Card entry={item} focused={f} />}
          </Focusable>
        )}
      />
    </View>
  );
}

/** Vertical D-pad grid of the same resume cards — used by the "Continua a
 * guardare" folder inside Film / Serie so you can jump back into a title. */
export function ContinueGrid({
  entries,
  onSelect,
  header,
}: {
  entries: ProgressEntry[];
  onSelect: (e: ProgressEntry) => void;
  header?: React.ReactElement;
}) {
  const s = useListScroll();
  const [w, setW] = useState(0);
  const pad = spacing.lg;
  const gap = spacing.md;
  const usable = (w || 960) - pad * 2;
  const cols = Math.max(3, Math.floor((usable + gap) / (POSTER_W + gap)));
  const rowH = POSTER_H + 48 + gap; // poster + title/label + row gap
  const PAD_TOP = spacing.sm;
  return (
    <FocusList
      ref={s.ref}
      onLayout={(e: any) => {
        setW(e.nativeEvent.layout.width);
        s.onLayout(e);
      }}
      onScroll={s.onScroll}
      data={entries}
      key={`cont-${cols}`}
      numColumns={cols}
      keyExtractor={(e: ProgressEntry) => e.key}
      ListHeaderComponent={header}
      columnWrapperStyle={cols > 1 ? { gap, paddingHorizontal: pad } : undefined}
      contentContainerStyle={{ gap, paddingTop: PAD_TOP, paddingBottom: spacing.xxl }}
      getItemLayout={(_: any, index: number) => ({ length: rowH, offset: PAD_TOP + rowH * Math.floor(index / cols), index })}
      onScrollToIndexFailed={(info: any) => {
        s.ref.current?.scrollToOffset({ offset: Math.floor(info.index / cols) * rowH, animated: false });
      }}
      renderItem={({ item, index }: { item: ProgressEntry; index: number }) => (
        <Focusable
          onSelect={() => onSelect(item)}
          autoFocus={index === 0}
          onFocus={() => s.reveal(PAD_TOP + Math.floor(index / cols) * rowH, rowH)}
          focusStyle={{}}
        >
          {(f) => <Card entry={item} focused={f} />}
        </Focusable>
      )}
    />
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
  focus: { borderColor: colors.borderFocus, shadowColor: colors.accent, shadowOpacity: 0.9, shadowRadius: 16, elevation: 14 },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(10,10,15,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: 'rgba(255,255,255,0.18)' },
  fill: { height: 5, backgroundColor: colors.accent },
});
