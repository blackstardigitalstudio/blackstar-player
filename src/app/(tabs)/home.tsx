import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ContinueRail } from '@/components/ContinueRail';
import { Rail } from '@/components/Rail';
import { Empty, GhostButton, Spinner, Txt } from '@/components/ui';
import { Focusable } from '@/tv/Focusable';
import { useKeyHandler } from '@/tv/RemoteProvider';
import { useStore } from '@/store/useStore';
import { usePlayback } from '@/lib/playback';
import { useVisibleContent } from '@/lib/content';
import { recommendFromRecents } from '@/lib/search';
import { becauseYouWatched, itemsInCategory, topCategories } from '@/lib/recommend';
import { useT } from '@/i18n';
import type { MediaItem } from '@/lib/types';
import { colors, radius, spacing } from '@/theme/tokens';

function Folder({ label, icon, color, count, onPress }: { label: string; icon: any; color: string; count?: number; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} style={styles.folder} focusStyle={styles.folderFocus}>
      {(f) => (
        <LinearGradient colors={[color + '33', colors.surface]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.folderInner, f && { borderColor: color }]}>
          <Ionicons name={icon} size={34} color={color} />
          <Txt variant="h3" numberOfLines={1} color={colors.text} style={{ fontWeight: '800' }}>
            {label}
          </Txt>
          {count ? (
            <View style={styles.folderCount}>
              <Txt variant="tiny" color={colors.textMuted}>
                {count}
              </Txt>
            </View>
          ) : null}
        </LinearGradient>
      )}
    </Focusable>
  );
}

export default function Home() {
  const t = useT();
  const router = useRouter();
  const play = usePlayback();
  const content = useVisibleContent();
  const loading = useStore((s) => s.loading);
  const error = useStore((s) => s.error);
  const recents = useStore((s) => s.recents);
  const favorites = useStore((s) => s.favorites);
  const progress = useStore((s) => s.progress);
  const taste = useStore((s) => s.taste);

  const pool = useMemo(() => [...content.movies, ...content.series, ...content.live], [content]);
  const recommended = useMemo(() => recommendFromRecents(recents, pool), [recents, pool]);
  const continueList = useMemo(
    () => Object.values(progress).filter((p) => p.position > 5).sort((a, b) => b.updatedAt - a.updatedAt),
    [progress],
  );
  const watchedIds = useMemo(() => new Set(recents.map((r) => r.id)), [recents]);
  const bywRows = useMemo(() => becauseYouWatched(recents, pool), [recents, pool]);
  const tasteRows = useMemo(
    () =>
      topCategories(taste, 3)
        .map((cat) => ({ cat, items: itemsInCategory(pool, cat, watchedIds) }))
        .filter((r) => r.items.length >= 4),
    [taste, pool, watchedIds],
  );

  const folders = useMemo(
    () =>
      [
        { key: 'live', label: t('nav.live'), icon: 'tv', color: colors.live, count: content.live.length, path: '/(tabs)/live' },
        { key: 'movies', label: t('nav.movies'), icon: 'film', color: colors.primary, count: content.movies.length, path: '/(tabs)/movies' },
        { key: 'series', label: t('nav.series'), icon: 'albums', color: colors.accent, count: content.series.length, path: '/(tabs)/series' },
        { key: 'search', label: t('nav.search'), icon: 'search', color: colors.success, count: 0, path: '/(tabs)/search' },
      ].filter((f) => f.key === 'search' || f.count > 0),
    [content, t],
  );

  // Number-bar zapping (TV).
  const [typed, setTyped] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpToNumber = useCallback(
    (num: string) => {
      const ch = content.live.find((c) => c.number === Number(num));
      setTyped('');
      if (ch) play.open(ch);
    },
    [content.live, play],
  );
  useKeyHandler(
    (key) => {
      if (key.startsWith('digit:')) {
        const next = (typed + key.split(':')[1]).slice(0, 4);
        setTyped(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => jumpToNumber(next), 1600);
        return true;
      }
      if (key === 'select' && typed) {
        if (timer.current) clearTimeout(timer.current);
        jumpToNumber(typed);
        return true;
      }
      return false;
    },
    [typed, jumpToNumber],
  );

  const go = (item: MediaItem) => play.open(item);
  const hasAny = pool.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Txt variant="h2">Blackstar</Txt>
        <GhostButton label={t('common.refresh')} icon="refresh" onPress={() => useStore.getState().refresh(true)} />
      </View>

      {loading && !hasAny ? (
        <Spinner label={t('home.loadingList')} />
      ) : !hasAny ? (
        <Empty
          icon="cloud-offline-outline"
          title={error ? t('home.cantLoad') : t('home.emptyList')}
          hint={error ?? t('home.emptyHint')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          {/* Big category folders */}
          <View style={styles.folders}>
            {folders.map((fld) => (
              <Folder key={fld.key} label={fld.label} icon={fld.icon} color={fld.color} count={fld.count || undefined} onPress={() => router.replace(fld.path as any)} />
            ))}
          </View>

          {/* Recommendations (kept) */}
          <ContinueRail
            entries={continueList}
            onSelect={(e) => play.playEntry(e.url, e.title, { key: e.key, poster: e.poster, resumeAt: e.position })}
          />
          {favorites.length ? <Rail title={t('home.favorites')} items={favorites} onSelect={go} variant="poster" /> : null}
          {bywRows.map((r) => (
            <Rail key={`byw-${r.seed.id}`} title={t('home.becauseWatched', { name: r.seed.name })} items={r.items} onSelect={go} variant="poster" />
          ))}
          {tasteRows.map((r) => (
            <Rail key={`cat-${r.cat}`} title={t('home.becauseLike', { cat: r.cat })} items={r.items} onSelect={go} variant="poster" />
          ))}
          <Rail title={t('home.recommended')} items={recommended} onSelect={go} variant="poster" />
        </ScrollView>
      )}

      {typed ? (
        <View style={styles.zap}>
          <Ionicons name="tv" size={28} color={colors.accent} />
          <Txt variant="display" color={colors.text}>
            {typed}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  folders: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  folder: { flexGrow: 1, flexBasis: 150, borderRadius: radius.lg },
  folderFocus: {},
  folderInner: {
    height: 104,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'center',
    gap: 6,
  },
  folderCount: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  zap: {
    position: 'absolute',
    top: spacing.xl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(10,10,15,0.94)',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.accent,
  },
});
