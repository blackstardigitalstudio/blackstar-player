import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, View } from 'react-native';
import { FocusScrollView } from '@/tv/FocusScroll';
import { ContinueRail } from '@/components/ContinueRail';
import { Rail } from '@/components/Rail';
import { Empty, Spinner, Txt } from '@/components/ui';
import { presetFolder } from '@/components/Browser';
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

// Fires the auto-start-last-channel at most once per app launch (module scope).
let autoStartedThisLaunch = false;

const TILE_H = 104;

/**
 * Set-top-box tile: wide and low, round icon badge, big label — the arrangement
 * you can read from the sofa instead of leaning in. Same language as the folder
 * tiles inside a section, so the whole app looks like one app.
 */
function HomeTile({ label, icon, count, autoFocus, onPress }: { label: string; icon: any; count?: string; autoFocus?: boolean; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} autoFocus={autoFocus} style={styles.tile} focusStyle={styles.tileFocus}>
      {() => (
        <View style={styles.tileRow}>
          <View style={styles.tileIcon}>
            <Ionicons name={icon} size={30} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Txt variant="h3" numberOfLines={1} style={{ fontWeight: '800' }}>
              {label}
            </Txt>
            {count ? (
              <Txt variant="small" color={colors.textMuted} style={{ marginTop: 2 }}>
                {count}
              </Txt>
            ) : null}
          </View>
        </View>
      )}
    </Focusable>
  );
}

/** Right-hand shortcut: one press straight to the thing, no menu in between. */
function Shortcut({ label, icon, onPress }: { label: string; icon: any; onPress: () => void }) {
  return (
    <Focusable onSelect={onPress} style={styles.shortcut} focusStyle={styles.tileFocus}>
      {(f) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <Ionicons name={icon} size={22} color={colors.accent} />
          <Txt variant="body" numberOfLines={1} color={f ? colors.text : colors.textMuted} style={{ fontWeight: '700', flex: 1 }}>
            {label}
          </Txt>
        </View>
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
  const bannerText = useStore((s) => s.settings.bannerText);
  const autoStart = useStore((s) => s.settings.autoStartLastChannel);
  const lastLiveId = useStore((s) => s.lastLiveId);
  const confirmExit = useStore((s) => s.settings.confirmExit);

  // Ask before exiting the app from Home (only while Home is focused). Elsewhere
  // BACK just navigates back.
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (!confirmExit) return false; // let the OS close the app
        Alert.alert('Blackstar Player', t('exit.confirm'), [
          { text: t('pin.cancel'), style: 'cancel' },
          { text: t('exit.yes'), style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]);
        return true; // consume back
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [confirmExit, t]),
  );

  // Recommendations pool = VOD only (movies+series), capped, so the taste engine
  // never tokenizes a 10k-channel live list on the render path (was a real hitch).
  const pool = useMemo(() => [...content.movies, ...content.series].slice(0, 2500), [content.movies, content.series]);
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

  // Duplex-style top: the sections as wide tiles on the left, and on the right
  // the three shortcuts the side menu CANNOT give you — resume, favourites,
  // recently watched. The tiles duplicate the side menu on purpose here: on a
  // 10-foot screen the first thing the eye lands on should be a target you can
  // hit, not a narrow icon strip.
  const sections = useMemo(
    () =>
      [
        { key: 'live', label: t('nav.live'), icon: 'tv' as const, n: content.live.length, countKey: 'br.channelsCount', path: '/(tabs)/live' },
        { key: 'movies', label: t('nav.movies'), icon: 'film' as const, n: content.movies.length, countKey: 'br.moviesCount', path: '/(tabs)/movies' },
        { key: 'series', label: t('nav.series'), icon: 'albums' as const, n: content.series.length, countKey: 'br.seriesCount', path: '/(tabs)/series' },
        { key: 'search', label: t('nav.search'), icon: 'search' as const, n: -1, countKey: '', path: '/(tabs)/search' },
      ].filter((sec) => sec.n !== 0),
    [content, t],
  );

  /** Section that actually holds the most of something, so a shortcut never
   *  opens an empty folder. */
  const richest = (ids: Set<string>): { kind: MediaItem['kind']; path: string } => {
    const count = (list: MediaItem[]) => list.filter((i) => ids.has(i.id)).length;
    const opts = [
      { kind: 'live' as const, path: '/(tabs)/live', n: count(content.live) },
      { kind: 'movie' as const, path: '/(tabs)/movies', n: count(content.movies) },
      { kind: 'series' as const, path: '/(tabs)/series', n: count(content.series) },
    ].sort((a, b) => b.n - a.n);
    return opts[0];
  };
  const openFolderShortcut = (ids: Set<string>, cat: string) => {
    const target = richest(ids);
    presetFolder(target.kind, cat);
    router.replace(target.path as any);
  };

  const go = (item: MediaItem) => play.open(item);
  const hasAny = content.live.length + content.movies.length + content.series.length > 0;

  // Auto-start the last live channel once per app launch (opt-in). Fires only when
  // content is loaded and the channel still exists; the player's Back returns here.
  useEffect(() => {
    if (autoStartedThisLaunch) return;
    if (!autoStart || !lastLiveId || !content.live.length) return;
    const ch = content.live.find((c) => c.id === lastLiveId);
    if (ch) {
      autoStartedThisLaunch = true;
      play.open(ch);
    }
  }, [autoStart, lastLiveId, content.live, play]);

  return (
    <View style={{ flex: 1 }}>
      {/* No "Aggiorna" button up here any more: it reloaded the channel list (which
          the app already refreshes on its own, and Impostazioni → "Aggiorna lista
          ora" does on demand, with a confirmation), it gave no feedback, and being
          the first focusable it stole the opening focus from the content. */}
      <View style={styles.header}>
        <Txt variant="h2" numberOfLines={1}>{bannerText || 'Blackstar'}</Txt>
      </View>

      {loading && !hasAny ? (
        <Spinner label={t('home.loadingList')} />
      ) : !hasAny ? (
        <Empty
          icon="cloud-offline-outline"
          title={error ? t('home.cantLoad') : t('home.emptyList')}
          hint={error ?? t('home.emptyHint')}
          // No list yet → send them straight to add one. On error → let them retry.
          action={
            error
              ? { label: t('common.refresh'), icon: 'refresh', onPress: () => useStore.getState().refresh(true) }
              : { label: t('set.addProfile'), icon: 'add', onPress: () => router.push('/onboarding') }
          }
        />
      ) : (
        <FocusScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
          <View style={styles.top}>
            <View style={styles.tiles}>
              {sections.map((sec, i) => (
                <HomeTile
                  key={sec.key}
                  label={sec.label}
                  icon={sec.icon}
                  count={sec.n > 0 ? t(sec.countKey, { n: sec.n }) : undefined}
                  autoFocus={i === 0}
                  onPress={() => router.replace(sec.path as any)}
                />
              ))}
            </View>
            <View style={styles.side}>
              {continueList.length ? (
                <Shortcut
                  label={t('home.continue')}
                  icon="play-circle"
                  onPress={() => {
                    const e = continueList[0];
                    play.playEntry(e.url, e.title, { key: e.key, poster: e.poster, resumeAt: e.position });
                  }}
                />
              ) : null}
              {favorites.length ? (
                <Shortcut
                  label={t('br.favorites')}
                  icon="heart"
                  onPress={() => openFolderShortcut(new Set(favorites.map((f) => f.id)), 'fav')}
                />
              ) : null}
              {recents.length ? (
                <Shortcut
                  label={t('br.recent')}
                  icon="time"
                  onPress={() => openFolderShortcut(new Set(recents.map((r) => r.id)), 'recent')}
                />
              ) : null}
            </View>
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
        </FocusScrollView>
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
  top: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tiles: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, alignContent: 'flex-start' },
  tile: {
    height: TILE_H,
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
  },
  tileRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tileIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surfaceHi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileFocus: { borderColor: colors.borderFocus, backgroundColor: colors.surfaceHi },
  side: { width: 280, gap: spacing.sm },
  shortcut: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
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
