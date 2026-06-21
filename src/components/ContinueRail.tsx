import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { FlatList, StyleSheet, View } from 'react-native';
import { Focusable } from '@/tv/Focusable';
import { colors, gradients, radius, spacing } from '@/theme/tokens';
import type { ProgressEntry } from '@/lib/types';
import { POSTER_W, POSTER_H } from './Card';
import { Txt } from './ui';

function pctLeft(e: ProgressEntry) {
  if (!e.duration) return '';
  const left = Math.max(0, e.duration - e.position);
  const m = Math.round(left / 60);
  return m > 0 ? `${m} min rimasti` : 'Quasi finito';
}

function Card({ entry, focused }: { entry: ProgressEntry; focused: boolean }) {
  const pct = entry.duration > 0 ? Math.min(1, entry.position / entry.duration) : 0;
  return (
    <View style={{ width: POSTER_W }}>
      <View style={[styles.poster, focused && styles.focus]}>
        {entry.poster ? (
          <Image source={{ uri: entry.poster }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
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
      <Txt variant="tiny">{pctLeft(entry)}</Txt>
    </View>
  );
}

export function ContinueRail({ entries, onSelect }: { entries: ProgressEntry[]; onSelect: (e: ProgressEntry) => void }) {
  if (!entries.length) return null;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Txt variant="h3" style={{ marginLeft: spacing.lg, marginBottom: spacing.sm }}>
        Continua a guardare
      </Txt>
      <FlatList
        horizontal
        data={entries}
        keyExtractor={(e) => e.key}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
        renderItem={({ item }) => (
          <Focusable onSelect={() => onSelect(item)} focusStyle={{}}>
            {(f) => <Card entry={item} focused={f} />}
          </Focusable>
        )}
      />
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
